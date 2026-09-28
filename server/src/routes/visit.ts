import { Hono } from "hono";
import { count, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../db/index.ts";
import { visitors } from "../db/schema.ts";
import { requireAuth } from "../auth/session.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";
import { visitorFor } from "../lib/visitors.ts";

/** The visitor counter. The visitor number is the row id. */
const limiter = rateLimit({ limit: 60, windowMs: 10 * 60 * 1000 });

export const visitRoutes = new Hono();

visitRoutes.post("/", async (c) => {
  const ipHash = hashIp(clientIp(c));
  const budget = limiter(ipHash);
  if (!budget.ok) {
    c.header("Retry-After", String(budget.retryAfter));
    return c.json({ error: "too many requests" }, 429);
  }

  const row = await visitorFor(ipHash, { bump: true });
  const [{ total }] = await db.select({ total: count() }).from(visitors);

  return c.json({
    number: row.id,
    visits: row.visits,
    since: row.firstSeenAt,
    total,
  });
});

/** Who has been here lately. Behind the login: visitors are mine to count, not to publish. */
visitRoutes.get("/stats", requireAuth, async (c) => {
  const since = (interval: string) => sql`now() - ${sql.raw(`interval '${interval}'`)}`;
  const seen = (column: AnyPgColumn, interval: string) =>
    sql<number>`count(*) filter (where ${column} >= ${since(interval)})`.mapWith(Number);

  const [row] = await db
    .select({
      total: count(),
      visits: sql<number>`coalesce(sum(${visitors.visits}), 0)`.mapWith(Number),
      newToday: seen(visitors.firstSeenAt, "24 hours"),
      seenToday: seen(visitors.lastSeenAt, "24 hours"),
      newWeek: seen(visitors.firstSeenAt, "7 days"),
      seenWeek: seen(visitors.lastSeenAt, "7 days"),
      returning: sql<number>`count(*) filter (where ${visitors.visits} > 1)`.mapWith(Number),
    })
    .from(visitors);

  return c.json(row);
});
