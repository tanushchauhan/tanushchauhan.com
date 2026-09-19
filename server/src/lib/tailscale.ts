/**
 * The tailnet's devices, from Tailscale's API, for the signed-in fleet card.
 *
 * The credential is an OAuth client with one scope, devices:core:read. It can
 * list devices and nothing else: it cannot change ACLs, mint auth keys,
 * approve or remove a device, or open a connection to anything. A personal API
 * key would work too, but it carries every permission its owner has and
 * expires every 90 days, so it is not accepted here.
 *
 * This server never joins the tailnet. It asks the control plane what exists;
 * it has no route to the devices themselves.
 */

const API = "https://api.tailscale.com/api/v2";
const CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 5000;
const MAX_DEVICES = 100;

/* A device counts as online if the control plane says it is connected. Older
   API responses lack that field, and for those a device seen in the last few
   minutes is online: a connected client checks in far more often than that. */
const ONLINE_WITHIN_MS = 5 * 60 * 1000;

export type TailnetDevice = {
  name: string;
  os: string | null;
  online: boolean;
  lastSeen: string | null;
  address: string | null;
  version: string | null;
  updateAvailable: boolean;
  keyExpiry: string | null;
};

export type Tailnet =
  | { configured: false }
  | { configured: true; ok: true; devices: TailnetDevice[]; checkedAt: string }
  | { configured: true; ok: false; error: string };

const clientId = () => Bun.env.TS_OAUTH_CLIENT_ID;
const clientSecret = () => Bun.env.TS_OAUTH_CLIENT_SECRET;

let token: { value: string; until: number } | null = null;

/* OAuth access tokens last an hour. Refresh a minute early so a request never
   goes out with one that expires on the way. */
const accessToken = async () => {
  if (token && Date.now() < token.until) return token.value;

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId()!,
      client_secret: clientSecret()!,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`token request failed (${res.status})`);

  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("token response had no token");
  const life = (body.expires_in ?? 3600) * 1000;
  token = { value: body.access_token, until: Date.now() + life - 60_000 };
  return token.value;
};

type RawDevice = {
  name?: string;
  hostname?: string;
  os?: string;
  lastSeen?: string;
  connectedToControl?: boolean;
  addresses?: string[];
  clientVersion?: string;
  updateAvailable?: boolean;
  expires?: string;
  keyExpiryDisabled?: boolean;
  isExternal?: boolean;
};

const str = (value: unknown, max = 80) =>
  typeof value === "string" && value.length ? value.slice(0, max) : null;

/* Only what the card and the terminal show. The API also returns the owner's
   login, the tailnet's name, tags, node keys and the device's public
   endpoints; none of that has a reason to leave this process. The name is cut
   at the first dot for the same reason: the rest is the tailnet's domain. */
const shape = (d: RawDevice): TailnetDevice => {
  const seen = str(d.lastSeen);
  const online =
    typeof d.connectedToControl === "boolean"
      ? d.connectedToControl
      : seen != null && Date.now() - Date.parse(seen) < ONLINE_WITHIN_MS;
  return {
    name: str(d.name?.split(".")[0], 40) ?? str(d.hostname, 40) ?? "unnamed",
    os: str(d.os, 20),
    online,
    lastSeen: seen,
    address: str(d.addresses?.find((a) => a.includes(".")), 20),
    version: str(d.clientVersion?.split("-")[0], 20),
    updateAvailable: d.updateAvailable === true,
    keyExpiry: d.keyExpiryDisabled ? null : str(d.expires),
  };
};

const load = async (): Promise<TailnetDevice[]> => {
  const res = await fetch(`${API}/tailnet/-/devices?fields=all`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // a revoked client: forget the token so the next try asks for a new one
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`device list failed (${res.status})`);

  const body = (await res.json()) as { devices?: RawDevice[] };
  return (body.devices ?? [])
    .filter((d) => !d.isExternal) // shared in from someone else's tailnet
    .slice(0, MAX_DEVICES)
    .map(shape)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
};

let cached: { at: number; value: Tailnet } | null = null;
let inflight: Promise<Tailnet> | null = null;

const refresh = () => {
  inflight ??= load()
    .then((devices): Tailnet => ({
      configured: true,
      ok: true,
      devices,
      checkedAt: new Date().toISOString(),
    }))
    .catch((error: Error): Tailnet => {
      // a failed refresh keeps the last good list rather than blanking the card
      if (cached?.value.configured && cached.value.ok) return cached.value;
      return { configured: true, ok: false, error: error.message };
    })
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

/**
 * The fleet endpoint is polled every 30 seconds per signed-in tab, and this is
 * one upstream call a minute however many there are. A stale list is served
 * while the next one loads, so the poll never waits on Tailscale.
 */
export const tailnet = async (): Promise<Tailnet> => {
  if (!clientId() || !clientSecret()) return { configured: false };
  if (!cached) return refresh();
  if (Date.now() - cached.at > CACHE_MS) void refresh();
  return cached.value;
};
