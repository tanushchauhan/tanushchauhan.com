import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

type Bucket = { count: number; resetAt: number };

/** In-memory fixed-window limiter. Fine for one container; it resets on deploy. */
export const rateLimit = ({ limit, windowMs }: { limit: number; windowMs: number }) => {
  const buckets = new Map<string, Bucket>();

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
 * The caller's address. Behind a proxy, only headers the proxy sets are
 * trusted: cf-connecting-ip, x-real-ip, or the rightmost x-forwarded-for entry.
 * The leftmost entry is whatever the client sent. Headers are ignored unless
 * TRUST_PROXY is set.
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
  }
  return "unknown";
};

/** Stable pseudonymous id for an address. The raw IP is never stored. */
export const hashIp = (ip: string) => {
  const salt = Bun.env.SESSION_SECRET ?? "dev-salt";
  return new Bun.CryptoHasher("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
};
