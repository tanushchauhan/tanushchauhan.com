import { Hono, type Context } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { HUB_SLUG, metricSamples, servers, services, type UnitState } from "../db/schema.ts";
import { isProbeableUrl, probe, PROBE_STALE_MS } from "../lib/probes.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";
import {
  AGENT_VERSION,
  configFor,
  enrollServer,
  mintEnrollmentToken,
  normaliseSlug,
  serverForKey,
  STALE_AFTER_MS,
} from "../lib/moontower.ts";
import { requireAuth } from "../auth/session.ts";
import { latestSample } from "../lib/metrics.ts";
import { tailnet } from "../lib/tailscale.ts";

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

const MAX_UNITS = 40;
const UNIT_NAME = /^[A-Za-z0-9@._\-\\:]+$/;

/**
 * Unit names are strings a reporting machine chose, and they end up rendered on
 * a card, so they are checked here rather than trusted. The cap is a size limit
 * on the row: a box with 300 units should not be able to put 300 of them in a
 * jsonb column every 30 seconds.
 */
const parseUnits = (value: unknown): UnitState[] | null => {
  if (!Array.isArray(value)) return null;
  const out: UnitState[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= MAX_UNITS) break;
    if (!raw || typeof raw !== "object") continue;
    const { n, a, s, r } = raw as Record<string, unknown>;
    if (typeof n !== "string" || !UNIT_NAME.test(n) || n.length > 80) continue;
    // deduped here too, not only in the agent: a duplicate would otherwise
    // spend the cap and push a real unit off the end of the list
    if (seen.has(n)) continue;
    seen.add(n);
    out.push({
      n,
      a: typeof a === "string" ? a.slice(0, 20) : "unknown",
      s: typeof s === "string" ? s.slice(0, 20) : "unknown",
      r: Math.round(num(r, 0, 1e6) ?? 0),
    });
  }
  return out;
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

  // an agent too old to collect units sends none, which must leave the last
  // snapshot alone rather than blanking the card
  const units = parseUnits(body.units);

  await db
    .update(servers)
    .set({
      lastSeenAt: new Date(),
      agentVersion: typeof body.agentVersion === "string" ? body.agentVersion.slice(0, 20) : server.agentVersion,
      osName: typeof body.os === "string" ? body.os.slice(0, 120) : server.osName,
      cores: typeof body.cores === "number" ? Math.round(body.cores) : server.cores,
      uptimeSeconds: Math.round(num(body.uptimeSeconds, 0, 2 ** 31 - 1) ?? 0) || null,
      units: units ?? server.units,
      failedUnits:
        units === null
          ? server.failedUnits
          : Math.round(num(body.failedUnits, 0, 10000) ?? 0),
    })
    .where(eq(servers.slug, server.slug));

  // configuration and a version string. Nothing here is executed by the agent.
  return c.json(configFor(server));
});

/* ---------- services ----------
 * The applications, as opposed to the machines. Managed by hand because the
 * list is short and I am the only one who edits it; the probing itself runs on
 * a timer in lib/probes.ts.
 */

moontowerRoutes.post("/services", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!name) return c.json({ error: "name required" }, 400);
  if (!isProbeableUrl(url)) return c.json({ error: "url must be http or https" }, 400);

  const slug = normaliseSlug(body?.slug ?? name);
  if (!slug) return c.json({ error: "name must contain a letter or a digit" }, 400);

  const [row] = await db
    .insert(services)
    .values({
      slug,
      name: name.slice(0, 60),
      url,
      server: typeof body?.server === "string" ? normaliseSlug(body.server) || null : null,
    })
    .onConflictDoNothing()
    .returning();

  if (!row) return c.json({ error: `"${slug}" is already on the list` }, 409);

  // probe it now rather than leaving it blank for up to a minute: adding a
  // service and being told nothing about it is a bad first impression
  const result = await probe(row.url);
  await db
    .update(services)
    .set({ ...result, checkedAt: new Date(), since: new Date() })
    .where(eq(services.slug, row.slug));

  return c.json({ ...row, ...result }, 201);
});

moontowerRoutes.delete("/services/:slug", requireAuth, async (c) => {
  const [row] = await db
    .delete(services)
    .where(eq(services.slug, c.req.param("slug")))
    .returning();
  if (!row) return c.json({ error: `no service named "${c.req.param("slug")}"` }, 404);
  return c.json({ removed: row.slug });
});

/* ---------- fleet ----------
 * Every reporting machine, behind requireAuth. Not because the numbers are
 * secret exactly, but knowing how much headroom a box has and how long it has
 * been up is reconnaissance if you are thinking about knocking it over.
 * Visitors get the portfolio, I get the vitals.
 */

const HISTORY_POINTS = 90; // 45 minutes at one sample every 30 seconds

type Row = {
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  memTotalMb: number | null;
  diskPct: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  load1: number | null;
};

/** The newest stored row, shaped like a live sample so the card renders one way. */
const latestFor = (history: Row[]) => {
  const last = history[history.length - 1];
  if (!last) return null;

  /*
   * Capacities do not change between readings, so one report that omits a
   * total should not blank the card. Rates are different: a missing cpuPct
   * means the agent did not measure it, and showing the previous one as
   * current would be inventing data.
   */
  const carried = <K extends keyof Row>(key: K) =>
    last[key] ?? [...history].reverse().find((h) => h[key] != null)?.[key] ?? null;

  return {
    cpuPct: last.cpuPct,
    memPct: last.memPct,
    memUsedMb: last.memUsedMb,
    memTotalMb: carried("memTotalMb"),
    diskPct: last.diskPct,
    diskUsedGb: last.diskUsedGb,
    diskTotalGb: carried("diskTotalGb"),
    load1: last.load1,
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
      diskPct: metricSamples.diskPct,
      diskUsedGb: metricSamples.diskUsedGb,
      diskTotalGb: metricSamples.diskTotalGb,
      load1: metricSamples.load1,
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

  const [watched, devices] = await Promise.all([
    db.select().from(services).orderBy(services.createdAt),
    tailnet(),
  ]);

  return c.json({
    version: AGENT_VERSION,
    deployedSecondsAgo: Math.floor(process.uptime()),
    env: Bun.env.NODE_ENV ?? "development",
    // every device on the tailnet, including the ones with no agent on them
    tailnet: devices,
    // one poll feeds both cards: they are the same question asked at two levels
    services: watched.map((s) => ({
      slug: s.slug,
      name: s.name,
      url: s.url,
      server: s.server,
      // same idea as a stale server: the last reading stops speaking for the
      // present once the loop that produced it has clearly stopped
      stale: !s.checkedAt || s.checkedAt.getTime() < Date.now() - PROBE_STALE_MS,
      ok: s.ok,
      status: s.status,
      latencyMs: s.latencyMs,
      error: s.error,
      since: s.since,
      checkedAt: s.checkedAt,
    })),
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
        // hub has no agent, so it has no systemd snapshot to report
        units: s.units ?? null,
        failedUnits: s.failedUnits,
      };
    }),
  });
});
