import { promises as dns } from "node:dns";
import { sql } from "drizzle-orm";
import { db } from "../db/index.ts";

/* ---------- user agent ---------- */

const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|discordbot|slackbot|linkedinbot|twitterbot|headless|phantomjs|lighthouse|pagespeed|gtmetrix|chrome-lighthouse|curl\/|wget\/|python-requests|axios\/|go-http-client|java\/|okhttp|postman/i;

export const isBotAgent = (ua: string) => BOT.test(ua);

const BROWSERS: [string, RegExp][] = [
  ["Edge", /Edg(?:iOS|A|)\/([\d.]+)/],
  ["Opera", /OPR\/([\d.]+)/],
  ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
  ["Safari", /Version\/([\d.]+).*Safari/],
];

const OSES: [string, RegExp][] = [
  ["iOS", /iPhone OS ([\d_]+)|iPad.*OS ([\d_]+)/],
  ["Android", /Android ([\d.]+)/],
  ["macOS", /Mac OS X ([\d_.]+)/],
  ["Windows", /Windows NT ([\d.]+)/],
  ["ChromeOS", /CrOS/],
  ["Linux", /Linux/],
];

/** Enough of a parse to group visits by. A full UA database is not worth the weight. */
export const parseAgent = (ua: string) => {
  const browser = BROWSERS.find(([, re]) => re.test(ua));
  const os = OSES.find(([, re]) => re.test(ua));
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const phone = !tablet && /Mobile|iPhone|Android|iPod/i.test(ua);

  return {
    browser: browser?.[0] ?? null,
    browserVersion: browser ? (ua.match(browser[1])?.[1] ?? null) : null,
    os: os?.[0] ?? null,
    device: tablet ? "tablet" : phone ? "phone" : "desktop",
    isBot: isBotAgent(ua),
  };
};

/* ---------- who owns the address ---------- */

// suffixes where the registrable name is three labels, not two
const LONG_SUFFIX =
  /\.(?:co|com|net|org|ac|gov|edu|or|ne|in)\.(?:uk|jp|au|nz|za|kr|br|mx|id|il|tr|sg|th|my)$/i;

/** utexas.edu out of dhcp-146-6-104-23.utexas.edu. Residential PTRs give the ISP. */
export const orgFromHost = (host: string) => {
  const name = host.replace(/\.$/, "").toLowerCase();
  if (!name.includes(".")) return null;
  const labels = name.split(".");
  const keep = LONG_SUFFIX.test(name) ? 3 : 2;
  return labels.slice(-keep).join(".");
};

type Lookup = { rdns: string | null; org: string | null; at: number };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const lookups = new Map<string, Lookup>();

/**
 * Reverse DNS for the address, cached by its hash. The name is what tells a
 * university or a company apart from a home connection. The address itself is
 * never written down.
 */
export const lookupOrg = async (ip: string, ipHash: string): Promise<Lookup> => {
  const hit = lookups.get(ipHash);
  if (hit && Date.now() - hit.at < WEEK_MS) return hit;

  let result: Lookup = { rdns: null, org: null, at: Date.now() };
  try {
    const [host] = await dns.reverse(ip);
    if (host) result = { rdns: host.slice(0, 200), org: orgFromHost(host), at: Date.now() };
  } catch {
    // no PTR record, which is the common case for mobile networks
  }

  if (lookups.size > 5000) lookups.clear();
  lookups.set(ipHash, result);
  return result;
};

/* ---------- keeping the tables small ---------- */

const RAW_EVENT_DAYS = 90;
const SESSION_DAYS = 400;
const TICK_MS = 12 * 60 * 60 * 1000;

const SESSION_DIMENSIONS: [string, string][] = [
  ["referrer", "referrer_host"],
  ["country", "country"],
  ["org", "org"],
  ["utm_source", "utm_source"],
  ["browser", "browser"],
  ["os", "os"],
  ["device", "device"],
];

const rollAndPrune = async () => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into visit_rollup (day, kind, key, count)
      select at::date, 'event', name, count(*)
      from visit_events
      where at < now() - ${sql.raw(`interval '${RAW_EVENT_DAYS} days'`)}
      group by 1, 3
      on conflict (day, kind, key) do update set count = visit_rollup.count + excluded.count
    `);
    await tx.execute(sql`
      delete from visit_events where at < now() - ${sql.raw(`interval '${RAW_EVENT_DAYS} days'`)}
    `);
  });

  await db.transaction(async (tx) => {
    for (const [kind, column] of SESSION_DIMENSIONS) {
      await tx.execute(sql`
        insert into visit_rollup (day, kind, key, count)
        select started_at::date, ${kind}, coalesce(${sql.raw(`"${column}"`)}, 'unknown'), count(*)
        from visit_sessions
        where started_at < now() - ${sql.raw(`interval '${SESSION_DAYS} days'`)} and is_bot = false
        group by 1, 3
        on conflict (day, kind, key) do update set count = visit_rollup.count + excluded.count
      `);
    }
    await tx.execute(sql`
      delete from visit_sessions where started_at < now() - ${sql.raw(`interval '${SESSION_DAYS} days'`)}
    `);
  });

  // a crawler that loaded the page and did nothing leaves a row worth nothing
  await db.execute(sql`
    delete from visit_sessions
    where is_bot = true and events = 0 and started_at < now() - interval '2 days'
  `);
};

export const startTelemetryUpkeep = () => {
  const tick = () => rollAndPrune().catch((err) => console.error("telemetry upkeep:", err));
  tick();
  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  return () => clearInterval(timer);
};
