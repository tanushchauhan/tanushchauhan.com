import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { services, type Service } from "../db/schema.ts";

/**
 * HTTP checks run from the hub. A unit can be active while the site behind it
 * returns 502, so the only real test is a request.
 */

const PROBE_MS = 60 * 1000;
const TIMEOUT_MS = 8 * 1000;

// three missed passes and a result is no longer shown as current
export const PROBE_STALE_MS = 3 * PROBE_MS;

/** Only a signed-in user can add a service, but the scheme is still checked. */
export const isProbeableUrl = (raw: string) => {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export type ProbeResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  error: string | null;
};

/** GET, not HEAD: some servers answer HEAD without touching the app, and some proxies refuse it. */
export const probe = async (url: string): Promise<ProbeResult> => {
  const started = performance.now();
  const abort = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: abort,
      headers: { "user-agent": "Moontower/1.0 (+https://tanushchauhan.com)" },
    });
    // drain, so a keep-alive connection is not left holding a body open
    await res.arrayBuffer().catch(() => undefined);

    return {
      // an auth wall still means the app is answering
      ok: res.status < 400,
      status: res.status,
      latencyMs: Math.round(performance.now() - started),
      error: res.status < 400 ? null : `HTTP ${res.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: null,
      latencyMs: Math.round(performance.now() - started),
      // TimeoutError's own message is empty in Bun, so name it
      error: (abort.aborted ? `no answer in ${TIMEOUT_MS / 1000}s` : message).slice(0, 200),
    };
  }
};

/** Writes a result, moving `since` only when the up/down state actually flips. */
const record = async (service: Service, result: ProbeResult) => {
  const flipped = service.ok !== result.ok;
  await db
    .update(services)
    .set({
      checkedAt: new Date(),
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      error: result.error,
      since: flipped || !service.since ? new Date() : service.since,
    })
    .where(eq(services.slug, service.slug));
};

export const probeAll = async () => {
  const rows = await db.select().from(services);
  await Promise.all(
    rows.map(async (service) => {
      const result = isProbeableUrl(service.url)
        ? await probe(service.url)
        : { ok: false, status: null, latencyMs: 0, error: "not a http(s) url" };
      await record(service, result);
    })
  );
  return rows.length;
};

export const startServiceProbes = () => {
  const tick = async () => {
    try {
      await probeAll();
    } catch (error) {
      console.warn("service probe failed:", error);
    }
  };

  void tick();
  const timer = setInterval(tick, PROBE_MS);
  return () => clearInterval(timer);
};
