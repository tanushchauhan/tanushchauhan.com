import { eq, sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { db } from "../db/index.ts";
import { visitors } from "../db/schema.ts";

/**
 * The visitor row for an address hash, created if this is the first time.
 * `bump` counts another visit; the telemetry route reads without counting, so
 * one page load is still one visit.
 */
export const visitorFor = async (ipHash: string, { bump = false } = {}) => {
  const read = async () =>
    (await db.select().from(visitors).where(eq(visitors.ipHash, ipHash)).limit(1))[0];

  const existing = await read();
  if (existing) {
    if (!bump) return existing;
    const [updated] = await db
      .update(visitors)
      .set({ lastSeenAt: new Date(), visits: sql`${visitors.visits} + 1` })
      .where(eq(visitors.ipHash, ipHash))
      .returning();
    return updated;
  }

  // two first visits at once: the loser reads the winner's row
  const [inserted] = await db.insert(visitors).values({ ipHash }).onConflictDoNothing().returning();
  return inserted ?? (await read());
};

/**
 * An address every visit from which was mine, such as home. A shared one, such
 * as a campus network, has other visits too and stays in.
 */
export const onlyMine = (visitorId: SQLWrapper): SQL => sql`(
  exists (select 1 from visit_sessions m where m.visitor_id = ${visitorId} and m.mine)
  and not exists (select 1 from visit_sessions o
                   where o.visitor_id = ${visitorId} and not o.mine and not o.is_bot)
)`;
