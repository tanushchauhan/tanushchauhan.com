import { Hono } from "hono";
import type { Context } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { visitEvents, visitSessions } from "../db/schema.ts";
import { readSession, requireAuth } from "../auth/session.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";
import { visitorFor } from "../lib/visitors.ts";
import { isBotAgent, lookupOrg, parseAgent } from "../lib/telemetry.ts";

/**
 * Event ingest. The browser batches and sends with sendBeacon, so a request
 * here has no response worth reading and must never be slow: the reverse DNS
 * lookup runs after the reply has gone out.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_MAX = 60;
const SESSION_EVENT_MAX = 2000;
const PROP_KEYS_MAX = 12;

const limiter = rateLimit({ limit: 240, windowMs: 10 * 60 * 1000 });

const str = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim().slice(0, max);
  return trimmed || null;
};

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const int = (value: unknown) => {
  const n = num(value);
  return n === null ? null : Math.trunc(n);
};

const frac = (value: unknown) => {
  const n = num(value);
  return n === null ? null : Math.min(1, Math.max(0, n));
};

const bool = (value: unknown) => (typeof value === "boolean" ? value : null);

const props = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value).slice(0, PROP_KEYS_MAX)) {
    if (typeof raw === "string") out[key.slice(0, 40)] = raw.slice(0, 200);
    else if (typeof raw === "number" || typeof raw === "boolean") out[key.slice(0, 40)] = raw;
  }
  return Object.keys(out).length ? out : null;
};

/** The half of a visit's context that the browser cannot know about itself. */
const contextFrom = (ctx: Record<string, unknown>, c: Context) => {
  const ua = c.req.header("user-agent") ?? "";
  return {
    referrerHost: str(ctx.rh, 120),
    referrerPath: str(ctx.rp, 200),
    utmSource: str(ctx.us, 80),
    utmMedium: str(ctx.um, 80),
    utmCampaign: str(ctx.uc, 80),
    utmTerm: str(ctx.ut, 80),
    utmContent: str(ctx.uo, 80),
    ref: str(ctx.ref, 60),
    clickId: str(ctx.cid, 120),
    landingPath: str(ctx.path, 200),

    country: str(c.req.header("cf-ipcountry"), 4),
    ua: ua.slice(0, 300) || null,
    ...parseAgent(ua),
    surface: ctx.sf === "phone" ? "phone" : "desktop",

    viewportW: int(ctx.vw),
    viewportH: int(ctx.vh),
    screenW: int(ctx.sw),
    screenH: int(ctx.sh),
    dpr: num(ctx.dpr),
    timezone: str(ctx.tz, 60),
    language: str(ctx.lang, 20),
    prefersDark: bool(ctx.dark),
    reducedMotion: bool(ctx.rm),
  };
};

export const telRoutes = new Hono();

telRoutes.post("/", async (c) => {
  const ip = clientIp(c);
  const ipHash = hashIp(ip);
  if (!limiter(ipHash).ok) return c.body(null, 429);

  const body = await c.req.json().catch(() => null);
  const id = typeof body?.sid === "string" && UUID.test(body.sid) ? body.sid : null;
  if (!id) return c.body(null, 400);

  const incoming = Array.isArray(body.events) ? body.events.slice(0, BATCH_MAX) : [];
  const opening = body.ctx && typeof body.ctx === "object";

  const bot = isBotAgent(c.req.header("user-agent") ?? "");
  const visitor = bot ? null : await visitorFor(ipHash);
  const context = opening ? contextFrom(body.ctx, c) : null;
  const authed = opening ? Boolean(await readSession(c)) : false;
  const lastMs = incoming.reduce((max: number, e: { ms?: unknown }) => {
    const ms = int(e?.ms) ?? 0;
    return ms > max ? ms : max;
  }, 0);
  // a visit that signs in mid-session should still read as signed in
  const signedIn = authed || incoming.some((e: { n?: unknown }) => e?.n === "login");

  const [session] = await db
    .insert(visitSessions)
    .values({
      id,
      visitorId: visitor?.id ?? null,
      durationMs: lastMs,
      authed: signedIn,
      ...(context ?? {}),
    })
    .onConflictDoUpdate({
      target: visitSessions.id,
      set: {
        lastSeenAt: new Date(),
        durationMs: sql`greatest(coalesce(${visitSessions.durationMs}, 0), ${lastMs})`,
        ...(signedIn ? { authed: true } : {}),
      },
    })
    .returning();

  // a crawler's row is kept so its traffic can be seen, but its clicks are noise
  if (!session || session.isBot || session.events >= SESSION_EVENT_MAX) return c.body(null, 204);

  const start = session.startedAt.getTime();
  const now = Date.now();
  const rows = incoming
    .filter((e: { n?: unknown }) => typeof e?.n === "string")
    .map((e: Record<string, unknown>, i: number) => ({
      sessionId: id,
      visitorId: visitor?.id ?? null,
      at: new Date(Math.min(Math.max(start + (int(e.ms) ?? 0), start), now)),
      seq: int(e.s) ?? session.events + i,
      name: str(e.n, 60) ?? "event",
      target: str(e.t, 120),
      props: props(e.p),
      x: frac(e.x),
      y: frac(e.y),
    }));

  if (rows.length) {
    await db.insert(visitEvents).values(rows);
    await db
      .update(visitSessions)
      .set({ events: sql`${visitSessions.events} + ${rows.length}` })
      .where(eq(visitSessions.id, id));
  }

  if (opening && !session.isBot) {
    // after the reply: a PTR lookup can take a second and nothing is waiting on it
    lookupOrg(ip, ipHash)
      .then(({ rdns, org }) =>
        rdns || org
          ? db.update(visitSessions).set({ rdns, org }).where(eq(visitSessions.id, id))
          : null
      )
      .catch(() => null);
  }

  return c.body(null, 204);
});

/* ---------- reports ---------- */

/** Days are interpolated into intervals, so they are clamped to an integer first. */
const daysFrom = (c: Context) => {
  const days = Math.trunc(Number(c.req.query("days")));
  return Number.isFinite(days) ? Math.min(400, Math.max(1, days)) : 30;
};

const since = (days: number) => sql.raw(`interval '${days} days'`);

const rows = async <T>(query: ReturnType<typeof sql>) =>
  (await db.execute(query)) as unknown as T[];

/**
 * Live sessions only: every report hides crawlers. `known` drops the rows with
 * nothing to show, which is most of them for a campaign tag nobody used.
 */
const topOf = (
  column: string,
  days: number,
  { limit = 8, known = false }: { limit?: number; known?: boolean } = {}
) =>
  rows<{ key: string; count: number }>(sql`
    select coalesce(nullif(${sql.raw(`"${column}"`)}, ''), 'unknown') as key, count(*)::int as count
    from visit_sessions
    where is_bot = false and started_at >= now() - ${since(days)}
      ${known ? sql`and nullif(${sql.raw(`"${column}"`)}, '') is not null` : sql``}
    group by 1 order by 2 desc, 1 limit ${limit}
  `);

telRoutes.get("/overview", requireAuth, async (c) => {
  const days = daysFrom(c);

  const [totals] = await rows<Record<string, number>>(sql`
    select
      count(*)::int as sessions,
      count(distinct visitor_id)::int as visitors,
      coalesce(sum(events), 0)::int as events,
      coalesce(round(avg(nullif(duration_ms, 0)))::int, 0) as avg_duration_ms,
      count(*) filter (where events <= 1)::int as bounced,
      count(*) filter (where authed)::int as signed_in,
      count(*) filter (where surface = 'phone')::int as on_phone
    from visit_sessions
    where is_bot = false and started_at >= now() - ${since(days)}
  `);

  const [{ bots }] = await rows<{ bots: number }>(sql`
    select count(*)::int as bots from visit_sessions
    where is_bot = true and started_at >= now() - ${since(days)}
  `);

  const daily = await rows<{ day: string; sessions: number; visitors: number }>(sql`
    select started_at::date as day, count(*)::int as sessions,
           count(distinct visitor_id)::int as visitors
    from visit_sessions
    where is_bot = false and started_at >= now() - ${since(days)}
    group by 1 order by 1
  `);

  return c.json({ days, ...totals, bots, daily });
});

telRoutes.get("/traffic", requireAuth, async (c) => {
  const days = daysFrom(c);
  const [referrers, campaigns, refs, countries, orgs, browsers, systems, devices] =
    await Promise.all([
      topOf("referrer_host", days, { known: true }),
      topOf("utm_campaign", days, { known: true }),
      topOf("ref", days, { known: true }),
      topOf("country", days),
      topOf("org", days, { limit: 12, known: true }),
      topOf("browser", days),
      topOf("os", days),
      topOf("device", days),
    ]);

  const sources = await rows<{ key: string; count: number }>(sql`
    select coalesce(utm_source, referrer_host, 'direct') as key, count(*)::int as count
    from visit_sessions
    where is_bot = false and started_at >= now() - ${since(days)}
    group by 1 order by 2 desc, 1 limit 10
  `);

  return c.json({
    days,
    sources,
    referrers,
    campaigns,
    refs,
    countries,
    orgs,
    browsers,
    systems,
    devices,
  });
});

/** Recent visits, each with the trail of what they opened, in order. */
telRoutes.get("/sessions", requireAuth, async (c) => {
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(c.req.query("limit"))) || 20));

  const list = await rows<Record<string, unknown>>(sql`
    select s.id, s.visitor_id, s.duration_ms, s.events, s.country, s.org, s.rdns,
           s.browser, s.os, s.device, s.surface, s.referrer_host, s.utm_source, s.utm_campaign,
           s.ref, s.authed, v.visits as visitor_visits,
           to_char(s.started_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as started_at,
           (select string_agg(t.label, ' > ' order by t.seq)
              from (select coalesce(e.target, e.name) as label, e.seq
                      from visit_events e
                     where e.session_id = s.id
                       and e.name in ('window_open', 'app_open', 'project_open',
                                      'terminal_command', 'link_click', 'guestbook_post')
                     order by e.seq limit 10) t) as trail
    from visit_sessions s
    left join visitors v on v.id = s.visitor_id
    where s.is_bot = false
    order by s.started_at desc
    limit ${limit}
  `);

  return c.json({ sessions: list });
});

telRoutes.get("/funnel", requireAuth, async (c) => {
  const days = daysFrom(c);
  const [row] = await rows<Record<string, number>>(sql`
    with reached as (
      select s.id,
        exists(select 1 from visit_events e where e.session_id = s.id
                 and e.name in ('window_open', 'app_open')) as opened,
        exists(select 1 from visit_events e where e.session_id = s.id
                 and e.name = 'project_open') as project,
        exists(select 1 from visit_events e where e.session_id = s.id
                 and e.name = 'terminal_command') as terminal,
        exists(select 1 from visit_events e where e.session_id = s.id
                 and e.name = 'link_click') as clicked,
        exists(select 1 from visit_events e where e.session_id = s.id
                 and e.name = 'guestbook_post') as wrote
      from visit_sessions s
      where s.is_bot = false and s.started_at >= now() - ${since(days)}
    )
    select count(*)::int as landed,
           count(*) filter (where opened)::int as opened,
           count(*) filter (where project)::int as project,
           count(*) filter (where terminal)::int as terminal,
           count(*) filter (where clicked)::int as clicked,
           count(*) filter (where wrote)::int as wrote
    from reached
  `);

  return c.json({ days, ...row });
});

telRoutes.get("/paths", requireAuth, async (c) => {
  const days = daysFrom(c);

  const first = await rows<{ key: string; count: number }>(sql`
    select coalesce(target, 'unknown') as key, count(*)::int as count
    from (select distinct on (e.session_id) e.session_id, e.target
            from visit_events e join visit_sessions s on s.id = e.session_id
           where s.is_bot = false and e.at >= now() - ${since(days)}
             and e.name in ('window_open', 'app_open')
           order by e.session_id, e.seq) opening
    group by 1 order by 2 desc, 1 limit 10
  `);

  const moves = await rows<{ key: string; count: number }>(sql`
    select step.from_target || ' > ' || step.to_target as key, count(*)::int as count
    from (select e.target as from_target,
                 lead(e.target) over (partition by e.session_id order by e.seq) as to_target
            from visit_events e join visit_sessions s on s.id = e.session_id
           where s.is_bot = false and e.at >= now() - ${since(days)}
             and e.name in ('window_open', 'app_open')) step
    where step.to_target is not null and step.from_target is not null
      and step.to_target <> step.from_target
    group by 1 order by 2 desc, 1 limit 10
  `);

  return c.json({ days, first, moves });
});

telRoutes.get("/events", requireAuth, async (c) => {
  const days = daysFrom(c);
  const name = c.req.query("name");

  const list = await rows<{ name: string; target: string; count: number; sessions: number }>(sql`
    select e.name, coalesce(e.target, '') as target, count(*)::int as count,
           count(distinct e.session_id)::int as sessions
    from visit_events e join visit_sessions s on s.id = e.session_id
    where s.is_bot = false and e.at >= now() - ${since(days)}
      ${name ? sql`and e.name = ${name}` : sql``}
    group by 1, 2 order by 3 desc, 1 limit 30
  `);

  return c.json({ days, events: list });
});

/** Click positions as fractions of the viewport, so an overlay reads at any size. */
telRoutes.get("/heatmap", requireAuth, async (c) => {
  const days = daysFrom(c);
  const surface = c.req.query("surface") === "phone" ? "phone" : "desktop";

  const points = await rows<{ x: number; y: number; target: string }>(sql`
    select e.x, e.y, coalesce(e.target, '') as target
    from visit_events e join visit_sessions s on s.id = e.session_id
    where s.is_bot = false and e.x is not null and e.y is not null
      and s.surface = ${surface} and e.at >= now() - ${since(days)}
    order by e.at desc limit 3000
  `);

  return c.json({ days, surface, points });
});

/* The spelling postgres hands back is not one every browser will parse. The
   column is always written here, never taken from a request. */
const utc = (column: string) =>
  sql.raw(`to_char(${column} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`);

/** Everyone who has been here, newest first, with the shape of their visits. */
telRoutes.get("/people", requireAuth, async (c) => {
  const limit = Math.min(200, Math.max(1, Math.trunc(Number(c.req.query("limit"))) || 40));

  const people = await rows<Record<string, unknown>>(sql`
    select v.id, v.visits,
           ${utc("v.first_seen_at")} as first_seen,
           ${utc("v.last_seen_at")} as last_seen,
           count(s.id)::int as sessions,
           coalesce(sum(s.events), 0)::int as events,
           coalesce(sum(s.duration_ms), 0)::int as total_ms,
           (array_agg(s.country order by s.started_at desc) filter (where s.country is not null))[1] as country,
           (array_agg(s.org order by s.started_at desc) filter (where s.org is not null))[1] as org,
           (array_agg(s.browser order by s.started_at desc) filter (where s.browser is not null))[1] as browser,
           (array_agg(s.os order by s.started_at desc) filter (where s.os is not null))[1] as os,
           (array_agg(coalesce(s.utm_source, s.referrer_host) order by s.started_at)
              filter (where coalesce(s.utm_source, s.referrer_host) is not null))[1] as found_by
    from visitors v
    left join visit_sessions s on s.visitor_id = v.id and s.is_bot = false
    group by v.id
    order by v.last_seen_at desc
    limit ${limit}
  `);

  return c.json({ people });
});

/** One visit in full: its context, and every event in order. */
telRoutes.get("/visit/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (!UUID.test(id)) return c.json({ error: "not found" }, 404);

  const [visit] = await rows<Record<string, unknown>>(sql`
    select s.*, ${utc("s.started_at")} as started_at, ${utc("s.last_seen_at")} as last_seen_at
    from visit_sessions s where s.id = ${id}
  `);
  if (!visit) return c.json({ error: "not found" }, 404);

  const events = await rows<Record<string, unknown>>(sql`
    select seq, name, target, props, x, y, ${utc("visit_events.at")} as at
    from visit_events where session_id = ${id} order by seq
  `);

  return c.json({ visit, events });
});

/** Who is on the site now, for the value of "now" that a page load can prove. */
telRoutes.get("/live", requireAuth, async (c) => {
  const here = await rows<Record<string, unknown>>(sql`
    select s.id, s.visitor_id, s.country, s.org, s.browser, s.os, s.surface, s.events,
           s.utm_source, s.referrer_host, ${utc("s.last_seen_at")} as last_seen_at,
           (select coalesce(e.target, e.name) from visit_events e
             where e.session_id = s.id order by e.seq desc limit 1) as doing
    from visit_sessions s
    where s.is_bot = false and s.last_seen_at >= now() - interval '5 minutes'
    order by s.last_seen_at desc
    limit 20
  `);

  return c.json({ here });
});
