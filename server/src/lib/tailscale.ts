/**
 * Tailnet devices for the signed-in fleet card, read with an OAuth client
 * scoped to devices:core:read. The server never joins the tailnet.
 */

const API = "https://api.tailscale.com/api/v2";
const CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 5000;
const MAX_DEVICES = 100;

// older API responses lack connectedToControl, so fall back to lastSeen
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

// tokens last an hour; refresh a minute early
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

// only the fields the card needs; the name is cut at the first dot
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
      // keep the last good list if a refresh fails
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

/** Cached for a minute and served stale while it refreshes. */
export const tailnet = async (): Promise<Tailnet> => {
  if (!clientId() || !clientSecret()) return { configured: false };
  if (!cached) return refresh();
  if (Date.now() - cached.at > CACHE_MS) void refresh();
  return cached.value;
};
