import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { metricSamples, siteStatus } from "../db/schema.ts";
import { requireAuth } from "../auth/session.ts";
import { latestSample } from "../lib/metrics.ts";

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

  /*
   * restrictedContributionsCount is the count of work done in private repos.
   * GitHub returns it as a bare number with no repository, message, or date
   * detail attached, which is exactly the anonymised shape a public profile
   * shows. It is only non-zero when "Include private contributions on my
   * profile" is enabled in GitHub settings, and it needs no repo scope: a
   * read-only user token is enough, so this server never holds a credential
   * that could read private source.
   */
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          restrictedContributionsCount
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
          restrictedContributionsCount?: number;
          contributionCalendar?: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const collection = body?.data?.user?.contributionsCollection;
  const calendar = collection?.contributionCalendar;
  if (!calendar) throw new Error("unexpected graphql shape");

  const days: { date: string; count: number }[] = calendar.weeks.flatMap(
    (w: { contributionDays: { date: string; contributionCount: number }[] }) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))
  );

  // the heatmap only needs the trailing ~17 weeks to look right at widget size
  return {
    available: true as const,
    total: calendar.totalContributions as number,
    private: collection?.restrictedContributionsCount ?? 0,
    days: days.slice(-119),
  };
};

/* ---------- latest commit ----------
 * Deliberately not the events API. /users/{user}/events/public only retains
 * roughly 90 days, so someone whose recent work is private reads as "no recent
 * pushes" while their public repos still have perfectly good commits sitting
 * there. Asking for repositories sorted by push date has no such window.
 *
 * Forks are skipped (the newest commit there is usually upstream's, not mine)
 * and commits are filtered by author, so a merged PR from someone else does not
 * get reported as my latest work. Both calls are public: no token required.
 */
const loadLatestCommit = async () => {
  const repoRes = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&direction=desc&per_page=10&type=owner`,
    { headers: ghHeaders() }
  );
  if (!repoRes.ok) throw new Error(`github repos ${repoRes.status}`);

  const repos = await repoRes.json();
  if (!Array.isArray(repos)) throw new Error("unexpected repos shape");

  const target = repos.find((r) => !r?.fork && !r?.archived);
  if (!target) return { available: false as const, reason: "no public repos" };

  const commitRes = await fetch(
    `https://api.github.com/repos/${GITHUB_USER}/${target.name}/commits?author=${GITHUB_USER}&per_page=1`,
    { headers: ghHeaders() }
  );
  if (!commitRes.ok) throw new Error(`github commits ${commitRes.status}`);

  const commits = await commitRes.json();
  if (!Array.isArray(commits) || !commits.length) {
    return { available: false as const, reason: "no commits found" };
  }

  const head = commits[0];
  return {
    available: true as const,
    repo: String(target.name),
    message: String(head?.commit?.message ?? "").split("\n")[0].slice(0, 120),
    sha: String(head?.sha ?? "").slice(0, 7),
    at: (head?.commit?.author?.date ?? head?.commit?.committer?.date) as string,
    url: String(head?.html_url ?? ""),
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

/* ---------- system ----------
 * Behind requireAuth, and not because the numbers are secret: knowing how much
 * headroom the box has and how long it has been up is reconnaissance if you are
 * thinking about knocking it over. Visitors get the portfolio, I get the vitals.
 */

const HISTORY_POINTS = 90; // 45 minutes at one sample every 30 seconds

widgetRoutes.get("/system", requireAuth, async (c) => {
  const now = latestSample();

  const rows = await db
    .select({
      at: metricSamples.at,
      cpuPct: metricSamples.cpuPct,
      memPct: metricSamples.memPct,
    })
    .from(metricSamples)
    .orderBy(desc(metricSamples.at))
    .limit(HISTORY_POINTS);

  return c.json({
    // null until the sampler's second tick: a CPU percentage is a rate, so the
    // first reading after a boot genuinely has nothing to compare against
    sample: now,
    uptimeSeconds: Math.floor(process.uptime()),
    env: Bun.env.NODE_ENV ?? "development",
    history: rows.reverse(), // oldest first, the order a sparkline draws in
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
