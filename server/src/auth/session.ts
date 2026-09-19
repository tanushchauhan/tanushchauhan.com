import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { sessions } from "../db/schema.ts";

export const COOKIE_NAME = "tc_session";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// refresh at most daily, so most reads do not write
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Required, with no fallback, so a known default can never sign production
 * cookies. It also salts guestbook IP hashes.
 */
const secret = () => {
  const value = Bun.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return value;
};

const sha256 = (value: string) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const newToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
};

/** Cookies are only marked Secure in production so http://localhost still works. */
const isProduction = () => Bun.env.NODE_ENV === "production";

export const createSession = async (c: Context, credentialId: string) => {
  const token = newToken();
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);

  await db.insert(sessions).values({
    tokenHash: sha256(token),
    credentialId,
    expiresAt,
    userAgent: c.req.header("user-agent")?.slice(0, 300) ?? null,
  });

  await setSignedCookie(c, COOKIE_NAME, token, secret(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });

  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  return { expiresAt };
};

/**
 * The caller's session, or null. Removing a passkey clears every session, so
 * this does not check that the credential still exists.
 */
export const readSession = async (c: Context) => {
  const token = await getSignedCookie(c, secret(), COOKIE_NAME);
  if (!token) return null;

  const tokenHash = sha256(token);
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), expiresAt })
      .where(eq(sessions.tokenHash, tokenHash));

    await setSignedCookie(c, COOKIE_NAME, token, secret(), {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "Lax",
      path: "/",
      expires: expiresAt,
    });
  }

  return row;
};

export const destroySession = async (c: Context) => {
  const token = await getSignedCookie(c, secret(), COOKIE_NAME);
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
};

export const destroyAllSessions = () => db.delete(sessions);

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "authentication required" }, 401);
  c.set("session", session);
  await next();
};
