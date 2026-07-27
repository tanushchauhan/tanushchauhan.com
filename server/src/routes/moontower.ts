import { Hono, type Context } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { HUB_SLUG, metricSamples, servers } from "../db/schema.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";
import {
  AGENT_VERSION,
  configFor,
  enrollServer,
  mintEnrollmentToken,
  serverForKey,
  STALE_AFTER_MS,
} from "../lib/moontower.ts";
import { requireAuth } from "../auth/session.ts";
import { latestSample } from "../lib/metrics.ts";

/**
 * The endpoints Moontower agents talk to. Both are unauthenticated in the
 * session sense (an agent has no cookie) and authenticated in every other:
 * enrollment needs a single-use token, reporting needs that server's own key.
 */
export const moontowerRoutes = new Hono();

// Enrollment is rare and expensive to get wrong, so it gets a tight budget
// keyed by address. Reporting is once every 30 seconds per server and is keyed
// by the presented credential instead: several boxes behind one office NAT
// share an address, and they should not share a budget.
const enrollLimiter = rateLimit({ limit: 10, windowMs: 60 * 60 * 1000 });
const ingestLimiter = rateLimit({ limit: 240, windowMs: 10 * 60 * 1000 });

const bearer = (header: string | undefined) =>
  header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;

const tooMany = (c: Context, retryAfter: number) =>
  c.json({ error: "too many requests", retryAfter }, 429, {
    "retry-after": String(retryAfter),
  });

/** A number, or null. Rejects NaN and infinities rather than storing them. */
const num = (value: unknown, min: number, max: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
};

/**
 * Mints an enrollment token for a signed-in session, so adding a server is a
 * command in the site's own terminal rather than a docker exec. The CLI script
 * stays as break-glass for when logging in is exactly what is broken, the same
 * split as the passkey bootstrap tokens.
 */
moontowerRoutes.post("/enroll-token", requireAuth, async (c) => {
  const { token, expiresAt } = await mintEnrollmentToken();
  const origin = Bun.env.ORIGIN ?? new URL(c.req.url).origin;
  return c.json({
    token,
    expiresAt,
    minutes: Math.round((expiresAt.getTime() - Date.now()) / 60000),
    command: `curl -fsSL ${origin}/moontower/install.sh | sh -s -- --token ${token} --name "NAME"`,
  });
});

/** Deleting a server revokes its key and drops its readings. */
moontowerRoutes.delete("/servers/:slug", requireAuth, async (c) => {
  const slug = c.req.param("slug");
  if (slug === HUB_SLUG) return c.json({ error: "the hub cannot remove itself" }, 400);

  const [row] = await db.delete(servers).where(eq(servers.slug, slug)).returning();
  if (!row) return c.json({ error: `no server named "${slug}"` }, 404);

  await db.delete(metricSamples).where(eq(metricSamples.server, slug));
  return c.json({ removed: row.slug });
});

moontowerRoutes.post("/enroll", async (c) => {
  const budget = enrollLimiter(hashIp(clientIp(c)));
  if (!budget.ok) return tooMany(c, budget.retryAfter);

  const body = await c.req.json().catch(() => null);
  const token = bearer(c.req.header("authorization")) ?? body?.token;
  if (typeof token !== "string") return c.json({ error: "enrollment token required" }, 401);

  const name = typeof body?.name === "string" ? body.name : "";
  if (!name.trim()) return c.json({ error: "name required" }, 400);

  const result = await enrollServer(token, body?.slug ?? name, name, {
    agentVersion: typeof body?.agentVersion === "string" ? body.agentVersion : undefined,
    osName: typeof body?.os === "string" ? body.os : undefined,
    cores: typeof body?.cores === "number" ? Math.round(body.cores) : undefined,
  });

  // 401 rather than 400: an invalid token is an authorization failure, and the
  // message stays vague about which part failed
  if (!result.ok) return c.json({ error: result.error }, 401);
  return c.json({ slug: result.slug, key: result.key, config: configFor(result) });
});

moontowerRoutes.post("/ingest", async (c) => {
  const key = bearer(c.req.header("authorization"));
  // hashed before it becomes a bucket key so raw credentials never sit in a map
  const budget = ingestLimiter(hashIp(key ?? clientIp(c)));
  if (!budget.ok) return tooMany(c, budget.retryAfter);

  const server = await serverForKey(key);
  if (!server) return c.json({ error: "unknown or revoked key" }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "body must be an object" }, 400);

  const cpuPct = num(body.cpuPct, 0, 100);
  const memPct = num(body.memPct, 0, 100);
  const memUsedMb = num(body.memUsedMb, 0, 1024 * 1024);
  if (cpuPct === null || memPct === null || memUsedMb === null) {
    return c.json({ error: "cpuPct, memPct and memUsedMb are required numbers" }, 400);
  }

  await db.insert(metricSamples).values({
    server: server.slug,
    // the row is timestamped here, not by the agent: a box with a wrong clock
    // would otherwise scatter points across the chart or land them in the future
    cpuPct,
    memPct,
    memUsedMb: Math.round(memUsedMb),
    memTotalMb: num(body.memTotalMb, 0, 1024 * 1024) ?? null,
    diskPct: num(body.diskPct, 0, 100),
    diskUsedGb: num(body.diskUsedGb, 0, 1024 * 1024),
    diskTotalGb: num(body.diskTotalGb, 0, 1024 * 1024),
    load1: num(body.load1, 0, 1024),
  });

  await db
    .update(servers)
    .set({
      lastSeenAt: new Date(),
      agentVersion: typeof body.agentVersion === "string" ? body.agentVersion.slice(0, 20) : server.agentVersion,
      osName: typeof body.os === "string" ? body.os.slice(0, 120) : server.osName,
      cores: typeof body.cores === "number" ? Math.round(body.cores) : server.cores,
      uptimeSeconds: Math.round(num(body.uptimeSeconds, 0, 2 ** 31 - 1) ?? 0) || null,
    })
    .where(eq(servers.slug, server.slug));

  // configuration and a version string. Nothing here is executed by the agent.
  return c.json(configFor(server));
});

/* ---------- fleet ----------
 * Every reporting machine, behind requireAuth. Not because the numbers are
 * secret exactly, but knowing how much headroom a box has and how long it has
 * been up is reconnaissance if you are thinking about knocking it over.
 * Visitors get the portfolio, I get the vitals.
 */

const HISTORY_POINTS = 90; // 45 minutes at one sample every 30 seconds

/** The newest stored row, shaped like a live sample so the card renders one way. */
const latestFor = (history: { cpuPct: number; memPct: number; memUsedMb: number; memTotalMb: number | null }[]) => {
  const last = history[history.length - 1];
  if (!last) return null;
  return {
    cpuPct: last.cpuPct,
    memPct: last.memPct,
    memUsedMb: last.memUsedMb,
    // How much memory a machine has does not change between readings, so one
    // report that omits it should not blank the card. Fall back to the most
    // recent reading that did include it.
    memTotalMb:
      last.memTotalMb ??
      [...history].reverse().find((h) => h.memTotalMb != null)?.memTotalMb ??
      null,
  };
};

moontowerRoutes.get("/fleet", requireAuth, async (c) => {
  const fleet = await db.select().from(servers).orderBy(servers.createdAt);
  const live = latestSample();

  /*
   * One query for the whole fleet rather than one per server. At a day of
   * retention across a handful of machines this table stays small, and the
   * (server, at) index makes the ordering free; slicing per server in memory
   * beats N round trips that each have to be awaited.
   */
  const rows = await db
    .select({
      server: metricSamples.server,
      at: metricSamples.at,
      cpuPct: metricSamples.cpuPct,
      memPct: metricSamples.memPct,
      memUsedMb: metricSamples.memUsedMb,
      memTotalMb: metricSamples.memTotalMb,
    })
    .from(metricSamples)
    .orderBy(desc(metricSamples.at))
    .limit(HISTORY_POINTS * Math.max(1, fleet.length));

  const historyFor = (slug: string) =>
    rows
      .filter((r) => r.server === slug)
      .slice(0, HISTORY_POINTS)
      .reverse(); // oldest first, the order a sparkline draws in

  const cutoff = Date.now() - STALE_AFTER_MS;

  return c.json({
    version: AGENT_VERSION,
    deployedSecondsAgo: Math.floor(process.uptime()),
    env: Bun.env.NODE_ENV ?? "development",
    servers: fleet.map((s) => {
      const isHub = s.slug === HUB_SLUG;
      const lastSeen = isHub ? Date.now() : s.lastSeenAt?.getTime() ?? 0;

      return {
        slug: s.slug,
        name: s.name,
        // hub measures itself in this process, so it cannot be stale while
        // this response is being written
        stale: !isHub && lastSeen < cutoff,
        lastSeenAt: isHub ? new Date().toISOString() : s.lastSeenAt,
        agentVersion: s.agentVersion,
        // config-plus-notify: the hub says a newer agent exists, and upgrading
        // stays a human re-running the installer
        updateAvailable: Boolean(s.agentVersion && s.agentVersion !== AGENT_VERSION),
        osName: s.osName,
        cores: s.cores,
        uptimeSeconds: isHub ? live?.hostUptimeSeconds ?? null : s.uptimeSeconds,
        // null until the sampler's second tick: a CPU percentage is a rate, so
        // the first reading after a boot has nothing to compare against
        sample: isHub ? live : latestFor(historyFor(s.slug)),
        appMemMb: isHub ? live?.appMemMb ?? null : null,
        history: historyFor(s.slug),
      };
    }),
  });
});
