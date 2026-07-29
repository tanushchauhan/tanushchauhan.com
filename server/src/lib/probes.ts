import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { services, type Service } from "../db/schema.ts";

/**
 * Probing the applications themselves.
 *
 * The agents report whether nginx and docker are running. That is the plumbing,
 * and it is worth knowing, but it is not the question. A vhost can be missing
 * from the config, a container can be up and returning 502, a certificate can
 * expire, and every unit on the box stays green through all of it. The only
 * thing that answers "is the site up" is asking the site.
 *
 * So this runs from the hub, not from the agents: an outward request over the
 * real network is what a visitor does, and it needs no privilege anywhere.
 */

const PROBE_MS = 60 * 1000;
const TIMEOUT_MS = 8 * 1000;

/** Only I can add a service, so the URL is trusted; the scheme still is not. */
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

/**
 * One request. Deliberately a GET rather than a HEAD: plenty of app servers
 * answer HEAD from a route that never touches the thing that is actually
 * broken, and some reverse proxies refuse it outright, which would read as an
 * outage that is not one.
 */
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
      // 2xx and 3xx are both fine. A 401 is not: the point is that the app is
      // answering, and an auth wall answering is the app answering.
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

/** One pass over every service, all at once: they are independent and few. */
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
