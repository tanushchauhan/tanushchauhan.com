import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

type Bucket = { count: number; resetAt: number };

/**
 * In-memory fixed-window limiter. Sufficient for a single-container personal
 * site: it resets on redeploy, which is an acceptable trade for having no
 * dependency on Redis. If this ever runs on more than one instance it must
 * move into Postgres, because each instance would otherwise keep its own count.
 */
export const rateLimit = ({ limit, windowMs }: { limit: number; windowMs: number }) => {
  const buckets = new Map<string, Bucket>();

  // keep the map from growing without bound on a long-lived process
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, windowMs).unref?.();

  return (key: string) => {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfter: 0 };
    }
    if (bucket.count >= limit) {
      return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { ok: true, retryAfter: 0 };
  };
};

/**
 * Client address, most trustworthy source first.
 *
 * Requests arrive as Cloudflare -> Traefik -> app, so the socket address is
 * only ever the proxy and a header has to identify the caller. Which header
 * matters: proxies *append* to x-forwarded-for, so a client that sends its own
 * `X-Forwarded-For: 1.2.3.4` produces `1.2.3.4, <real ip>` and the leftmost
 * entry is attacker-controlled. Reading it would let anyone mint a fresh
 * rate-limit bucket per request.
 *
 * cf-connecting-ip and x-real-ip are both *set* by the proxy rather than
 * appended to, so they cannot be forged upstream, and the rightmost
 * x-forwarded-for entry is the address the nearest proxy actually observed.
 *
 * All of this is gated on TRUST_PROXY, since off a proxy these headers are
 * pure client input. The final fallback is the socket rather than a constant:
 * a fixed string would put every caller in one shared bucket.
 */
export const clientIp = (c: Context) => {
  if (Bun.env.TRUST_PROXY === "true") {
    const cf = c.req.header("cf-connecting-ip");
    if (cf) return cf.trim();

    const real = c.req.header("x-real-ip");
    if (real) return real.trim();

    const fwd = c.req.header("x-forwarded-for");
    if (fwd) {
      const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
      const nearest = hops.at(-1);
      if (nearest) return nearest;
    }
  }

  try {
    const address = getConnInfo(c).remote.address;
    if (address) return address;
  } catch {
    /* no connection info available (non-Bun runtime or test harness) */
  }
  return "unknown";
};

/** Stable pseudonymous id for an address. The raw IP is never stored. */
export const hashIp = (ip: string) => {
  const salt = Bun.env.SESSION_SECRET ?? "dev-salt";
  return new Bun.CryptoHasher("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
};
