import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { siteStatus } from "../db/schema.ts";
import { requireAuth } from "../auth/session.ts";

const GITHUB_USER = "tanushchauhan";
const CACHE_MS = 5 * 60 * 1000;
const BUILDING_KEY = "building";
const BUILDING_MAX = 140;

/**
 * Everything here is proxied rather than called from the browser, for two
 * reasons: GITHUB_TOKEN must never reach the client bundle, and unauthenticated
 * GitHub allows 60 requests per hour per IP, which a handful of visitors would
 * exhaust. One cached fetch every 5 minutes serves everyone.
 */
type Cached<T> = { at: number; value: T };
const cache = new Map<string, Cached<unknown>>();

const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    // Serving a stale card beats serving an error card. GitHub being briefly
    // unreachable should not make the desktop look broken.
    if (hit) return hit.value;
    throw error;
  }
};

const ghHeaders = () => {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "tanushchauhan.com",
  };
  const token = Bun.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
};

/* ---------- contributions ----------
 * The contribution calendar only exists in GitHub's GraphQL API, which always
 * requires a token even for public data. Without one this reports unavailable
 * rather than guessing, and the widget renders an honest empty state. */
const loadContributions = async () => {
  if (!Bun.env.GITHUB_TOKEN) {
    return { available: false as const, reason: "GITHUB_TOKEN is not set" };
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...ghHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { login: GITHUB_USER } }),
  });

  if (!res.ok) throw new Error(`github graphql ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const calendar =
    body?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error("unexpected graphql shape");

  const days: { date: string; count: number }[] = calendar.weeks.flatMap(
    (w: { contributionDays: { date: string; contributionCount: number }[] }) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))
  );

  // the heatmap only needs the trailing ~17 weeks to look right at widget size
  return {
    available: true as const,
    total: calendar.totalContributions as number,
    days: days.slice(-119),
  };
};

/* ---------- latest commit ----------
 * Public events, so this works with or without a token. */
const loadLatestCommit = async () => {
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error(`github events ${res.status}`);

  const events = await res.json();
  if (!Array.isArray(events)) throw new Error("unexpected events shape");

  const push = events.find(
    (e) => e?.type === "PushEvent" && e?.payload?.commits?.length
  );
  if (!push) return { available: false as const, reason: "no recent pushes" };

  const commits = push.payload.commits;
  const head = commits[commits.length - 1];

  return {
    available: true as const,
    repo: String(push.repo?.name ?? "").replace(`${GITHUB_USER}/`, ""),
    message: String(head?.message ?? "").split("\n")[0].slice(0, 120),
    sha: String(head?.sha ?? "").slice(0, 7),
    at: push.created_at as string,
  };
};

export const widgetRoutes = new Hono();

widgetRoutes.get("/github", async (c) => {
  // both cards in one request: two widgets, one round trip on page load
  const [contributions, latest] = await Promise.all([
    cached("contributions", loadContributions).catch(() => ({
      available: false as const,
      reason: "github unavailable",
    })),
    cached("latest-commit", loadLatestCommit).catch(() => ({
      available: false as const,
      reason: "github unavailable",
    })),
  ]);

  return c.json({ contributions, latest });
});

/* ---------- now building ---------- */

widgetRoutes.get("/building", async (c) => {
  const [row] = await db
    .select()
    .from(siteStatus)
    .where(eq(siteStatus.key, BUILDING_KEY))
    .limit(1);

  return c.json({
    text: row?.value ?? null,
    updatedAt: row?.updatedAt ?? null,
  });
});

widgetRoutes.put("/building", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) return c.json({ error: "text is required" }, 400);
  if (text.length > BUILDING_MAX)
    return c.json({ error: `keep it under ${BUILDING_MAX} characters` }, 400);

  const [row] = await db
    .insert(siteStatus)
    .values({ key: BUILDING_KEY, value: text })
    .onConflictDoUpdate({
      target: siteStatus.key,
      set: { value: text, updatedAt: new Date() },
    })
    .returning();

  return c.json({ text: row.value, updatedAt: row.updatedAt });
});
