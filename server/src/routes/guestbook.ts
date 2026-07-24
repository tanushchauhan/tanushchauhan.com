import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { guestbook } from "../db/schema.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";

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
