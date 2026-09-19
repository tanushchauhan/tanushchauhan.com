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
 * Proxied and cached for 5 minutes, so GITHUB_TOKEN stays on the server and
 * visitors never hit GitHub's rate limit.
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
    // a stale card is better than an error card
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
 * The calendar is only in the GraphQL API, which needs a token even for
 * public data.
 */
const loadContributions = async () => {
  if (!Bun.env.GITHUB_TOKEN) {
    return { available: false as const, reason: "GITHUB_TOKEN is not set" };
  }

  // restrictedContributionsCount is a bare count of private work, and needs no repo scope
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

  return {
    available: true as const,
    total: calendar.totalContributions as number,
    private: collection?.restrictedContributionsCount ?? 0,
    days: days.slice(-119),
  };
};

/* ---------- latest commit ----------
 * Repos sorted by push date rather than the events API, which only keeps about
 * 90 days. Forks are skipped and commits are filtered by author.
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
