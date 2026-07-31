import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { guestbook } from "../db/schema.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";
import { requireAuth } from "../auth/session.ts";

const NAME_MAX = 40;
const MESSAGE_MAX = 500;
const PAGE_SIZE = 50;

// Counted before validation so malformed and honeypot requests consume quota
// too, otherwise a bot could hammer the endpoint for free. Set high enough
// that a person who mistypes and retries is never affected.
const limiter = rateLimit({ limit: 5, windowMs: 10 * 60 * 1000 });

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export const guestbookRoutes = new Hono();

guestbookRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      id: guestbook.id,
      name: guestbook.name,
      message: guestbook.message,
      createdAt: guestbook.createdAt,
    })
    .from(guestbook)
    .where(eq(guestbook.isHidden, false))
    .orderBy(desc(guestbook.createdAt))
    .limit(PAGE_SIZE);

  return c.json({ entries: rows });
});

/* ---------- moderation ----------
 * Anyone can write here, which is the point and also the problem: the entries
 * are mine to answer for whether I wrote them or not. `is_hidden` has been in
 * the schema since the table existed, but nothing could set it, so the only
 * way to take something down was a psql session against production. These are
 * that switch.
 *
 * Hiding is the normal move because it is reversible and keeps the row for the
 * rate limiter to reason about. Deleting is for the thing I do not want in the
 * database at all.
 */

const MODERATION_PAGE = 200;

guestbookRoutes.get("/all", requireAuth, async (c) => {
  const rows = await db
    .select()
    .from(guestbook)
    .orderBy(desc(guestbook.createdAt))
    .limit(MODERATION_PAGE);

  return c.json({
    entries: rows.map(({ ipHash, ...entry }) => ({
      ...entry,
      // A spam run is one source and many rows, and picking it out by eye takes
      // something to group by. Eight characters of an already salted hash is
      // enough to match rows against each other and no use for anything else.
      source: ipHash ? ipHash.slice(0, 8) : null,
    })),
  });
});

// One entry per request, id in the path. A bulk endpoint would want a body on
// DELETE, which is legal but not reliably forwarded, and moderation here is a
// handful of rows at a time: the terminal loops.
const parseId = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

guestbookRoutes.patch("/:id", requireAuth, async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "not an entry id" }, 400);

  const body = await c.req.json().catch(() => null);
  if (typeof body?.hidden !== "boolean") {
    return c.json({ error: "hidden must be true or false" }, 400);
  }

  const [row] = await db
    .update(guestbook)
    .set({ isHidden: body.hidden })
    .where(eq(guestbook.id, id))
    .returning({ id: guestbook.id, isHidden: guestbook.isHidden });

  if (!row) return c.json({ error: `no entry ${id}` }, 404);
  return c.json(row);
});

guestbookRoutes.delete("/:id", requireAuth, async (c) => {
  const id = parseId(c.req.param("id"));
  if (!id) return c.json({ error: "not an entry id" }, 400);

  const [row] = await db
    .delete(guestbook)
    .where(eq(guestbook.id, id))
    .returning({ id: guestbook.id });

  if (!row) return c.json({ error: `no entry ${id}` }, 404);
  return c.json({ removed: row.id });
});

guestbookRoutes.post("/", async (c) => {
  const ipHash = hashIp(clientIp(c));
  const { ok, retryAfter } = limiter(ipHash);
  if (!ok) {
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "slow down a moment, try again shortly" }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "expected a JSON body" }, 400);

  // bots fill every field they find; humans never see this one
  if (clean(body.website)) return c.json({ ok: true }, 201);

  const name = clean(body.name) || "anonymous";
  const message = clean(body.message);

  if (!message) return c.json({ error: "message is required" }, 400);
  if (message.length > MESSAGE_MAX)
    return c.json({ error: `message must be ${MESSAGE_MAX} characters or fewer` }, 400);
  if (name.length > NAME_MAX)
    return c.json({ error: `name must be ${NAME_MAX} characters or fewer` }, 400);

  const [entry] = await db
    .insert(guestbook)
    .values({ name, message, ipHash })
    .returning({
      id: guestbook.id,
      name: guestbook.name,
      message: guestbook.message,
      createdAt: guestbook.createdAt,
    });

  return c.json({ entry }, 201);
});
