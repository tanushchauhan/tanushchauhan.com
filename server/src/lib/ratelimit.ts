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
 * Behind Coolify the socket address is the proxy, so x-forwarded-for is what
 * identifies the caller, but it is trivially spoofed and is only honoured when
 * TRUST_PROXY says we are actually behind a proxy we control.
 *
 * The socket address is the last resort rather than a constant: falling back to
 * a fixed string would put every caller in one shared rate-limit bucket, so a
 * handful of posts would lock out the whole internet until the next restart.
 */
export const clientIp = (c: Context) => {
  if (Bun.env.TRUST_PROXY === "true") {
    const fwd = c.req.header("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = c.req.header("x-real-ip");
    if (real) return real.trim();
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
