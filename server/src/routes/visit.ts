import { Hono } from "hono";
import { count, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { visitors } from "../db/schema.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";

/**
 * The visitor counter.
 *
 * Called once per page load, and again by the terminal's `visitor` command,
 * which shares the page's request rather than making its own. A person is one
 * row however many times they come back, and the number they are given is the
 * row id: handed out on the first visit, never reassigned.
 *
 * Looked up before it is inserted rather than written with ON CONFLICT, because
 * a conflicting insert still spends a sequence value in Postgres, and a counter
 * that skips a number every time somebody reloads is not much of a counter.
 */
const limiter = rateLimit({ limit: 60, windowMs: 10 * 60 * 1000 });

export const visitRoutes = new Hono();

visitRoutes.post("/", async (c) => {
  const ipHash = hashIp(clientIp(c));
  const budget = limiter(ipHash);
  if (!budget.ok) {
    c.header("Retry-After", String(budget.retryAfter));
    return c.json({ error: "too many requests" }, 429);
  }

  let [row] = await db.select().from(visitors).where(eq(visitors.ipHash, ipHash)).limit(1);

  if (row) {
    [row] = await db
      .update(visitors)
      .set({ lastSeenAt: new Date(), visits: sql`${visitors.visits} + 1` })
      .where(eq(visitors.ipHash, ipHash))
      .returning();
  } else {
    // two first visits from one address at the same moment: the one that loses
    // the race reads the row the other one wrote
    const [inserted] = await db.insert(visitors).values({ ipHash }).onConflictDoNothing().returning();
    row =
      inserted ??
      (await db.select().from(visitors).where(eq(visitors.ipHash, ipHash)).limit(1))[0];
  }

  const [{ total }] = await db.select({ total: count() }).from(visitors);

  return c.json({
    number: row.id,
    visits: row.visits,
    since: row.firstSeenAt,
    total,
  });
});
