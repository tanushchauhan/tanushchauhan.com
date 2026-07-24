import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const guestbook = pgTable(
  "guestbook",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // hashed, never the raw address: enough to rate limit and to clean up a
    // spam run, without keeping a log of who visited
    ipHash: text("ip_hash"),
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (t) => [index("guestbook_created_at_idx").on(t.createdAt)]
);

export type GuestbookEntry = typeof guestbook.$inferSelect;
