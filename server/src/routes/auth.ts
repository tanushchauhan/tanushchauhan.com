import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { credentials } from "../db/schema.ts";
import { bootstrapTokenIsValid, consumeBootstrapToken } from "../auth/bootstrap.ts";
import {
  authenticationOptions,
  countCredentials,
  newChallengeId,
  registrationOptions,
  saveCredential,
  verifyAuthentication,
  verifyRegistration,
} from "../auth/webauthn.ts";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  readSession,
  requireAuth,
} from "../auth/session.ts";
import { clientIp, hashIp, rateLimit } from "../lib/ratelimit.ts";

// Tight, because these are the endpoints that actually mint credentials and
// sessions. Generous enough that a cancelled Touch ID prompt followed by a few
// retries never trips it.
const ceremonyLimiter = rateLimit({ limit: 20, windowMs: 10 * 60 * 1000 });

// /me is polled by every page load, so it cannot share the strict budget or a
// visitor who reloads a handful of times would lock themselves out of logging
// in. Reading your own session proves nothing and creates nothing; the limit
// here is only to stop it being used as a cheap way to hammer the database.
const readLimiter = rateLimit({ limit: 120, windowMs: 10 * 60 * 1000 });

// pairs a browser with the challenge issued to it, so one caller cannot consume
// another's; short lived and cleared as soon as the ceremony finishes
const CHALLENGE_COOKIE = "tc_challenge";

const setChallengeCookie = (c: Context, id: string) =>
  setCookie(c, CHALLENGE_COOKIE, id, {
    httpOnly: true,
    secure: Bun.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 300,
  });

export const authRoutes = new Hono();

// Every auth path is rate limited before any work is done. Anything that mints
// a credential or a session gets the strict budget; everything else gets the
// loose one. Defaulting to strict means a new endpoint added here is limited
// tightly until someone deliberately relaxes it.
const LOOSE = new Set(["/me", "/passkeys"]);

authRoutes.use("*", async (c, next) => {
  const path = c.req.path.replace(/^\/api\/auth/, "") || "/";
  const limiter = LOOSE.has(path) && c.req.method === "GET" ? readLimiter : ceremonyLimiter;

  const { ok, retryAfter } = limiter(hashIp(clientIp(c)));
  if (!ok) {
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "too many attempts, try again shortly" }, 429);
  }
  await next();
});

/** Who am I, and does this deployment have any passkeys yet? */
authRoutes.get("/me", async (c) => {
  const session = await readSession(c);
  const total = await countCredentials();

  if (!session) {
    // no passkeys yet means login is impossible and the shell is the only way
    // in, which the terminal surfaces rather than showing a dead prompt
    return c.json({ authenticated: false, needsEnrollment: total === 0 });
  }

  const [credential] = await db
    .select({ nickname: credentials.nickname })
    .from(credentials)
    .where(eq(credentials.id, session.credentialId))
    .limit(1);

  return c.json({
    authenticated: true,
    needsEnrollment: false,
    user: "tanush",
    passkey: credential?.nickname ?? "unknown",
    expiresAt: session.expiresAt,
  });
});

/* ---------- registration ----------
 * The gate, in one place: you may enrol a passkey if you already hold a
 * session, or if you present a break-glass token minted from inside the
 * container. Nothing else qualifies.
 *
 * One option was to allow open registration whenever zero credentials
 * existed, to make first run easy. That is deliberately not implemented: this
 * site is already publicly reachable, so between deploying and enrolling there
 * would be an unauthenticated internet-facing endpoint handing out permanent
 * admin credentials to whoever called it first. Requiring a token costs one
 * command and closes the window entirely. */
const mayRegister = async (c: Context, token: string | undefined) =>
  Boolean(await readSession(c)) || bootstrapTokenIsValid(token);

authRoutes.post("/register/options", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  // validated but never consumed here: a cancelled Touch ID prompt must not
  // burn the token and send you back to the shell for another one
  if (!(await mayRegister(c, body?.bootstrapToken))) {
    return c.json({ error: "not authorized to register a passkey" }, 403);
  }

  const challengeId = newChallengeId();
  const options = await registrationOptions(challengeId);
  setChallengeCookie(c, challengeId);
  return c.json(options);
});

/*
 * Order matters here, and it is the reason verify and persist are separate:
 *
 *   1. authorize, without consuming the token
 *   2. verify the ceremony, which writes nothing
 *   3. burn the token atomically, rejecting if someone else already used it
 *   4. only now write the credential
 *
 * Consuming earlier would strand a cancelled prompt with a spent token.
 * Writing earlier would let an unauthorized caller register a passkey.
 */
authRoutes.post("/register/verify", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.response) return c.json({ error: "expected a registration response" }, 400);

  const usingSession = Boolean(await readSession(c));
  if (!usingSession && !(await bootstrapTokenIsValid(body?.bootstrapToken))) {
    return c.json({ error: "not authorized to register a passkey" }, 403);
  }

  const nickname =
    typeof body.nickname === "string" && body.nickname.trim()
      ? body.nickname.trim().slice(0, 60)
      : "passkey";

  const result = await verifyRegistration(
    getCookie(c, CHALLENGE_COOKIE),
    body.response,
    nickname
  );
  deleteCookie(c, CHALLENGE_COOKIE, { path: "/" });

  if (!result.ok) return c.json({ error: result.error }, 400);

  // the ceremony is proven; spend the token before writing anything
  if (!usingSession && !(await consumeBootstrapToken(body?.bootstrapToken))) {
    return c.json({ error: "enrollment token was already used" }, 403);
  }

  const credentialId = await saveCredential(result.record);

  // registering also logs you in, so first run does not need a second ceremony
  await createSession(c, credentialId);
  return c.json({ ok: true, nickname });
});

/* ---------- login ---------- */

authRoutes.post("/login/options", async (c) => {
  if ((await countCredentials()) === 0) {
    return c.json({ error: "no passkeys registered yet" }, 409);
  }
  const challengeId = newChallengeId();
  const options = await authenticationOptions(challengeId);
  setChallengeCookie(c, challengeId);
  return c.json(options);
});

authRoutes.post("/login/verify", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.response) return c.json({ error: "expected an authentication response" }, 400);

  const result = await verifyAuthentication(getCookie(c, CHALLENGE_COOKIE), body.response);
  deleteCookie(c, CHALLENGE_COOKIE, { path: "/" });

  if (!result.ok) return c.json({ error: result.error }, 401);

  await createSession(c, result.credentialId);
  return c.json({ ok: true, user: "tanush" });
});

authRoutes.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

/* ---------- passkey management, behind the login ---------- */

authRoutes.get("/passkeys", requireAuth, async (c) => {
  const rows = await db
    .select({
      id: credentials.id,
      nickname: credentials.nickname,
      createdAt: credentials.createdAt,
      lastUsedAt: credentials.lastUsedAt,
    })
    .from(credentials)
    .orderBy(desc(credentials.createdAt));

  return c.json({ passkeys: rows });
});

authRoutes.delete("/passkeys/:id", requireAuth, async (c) => {
  const total = await countCredentials();
  // removing the last passkey would lock the account out of its own admin
  // surface, recoverable only by shelling in for a bootstrap token
  if (total <= 1) {
    return c.json({ error: "cannot remove the only passkey" }, 409);
  }

  const id = c.req.param("id");
  const removed = await db
    .delete(credentials)
    .where(eq(credentials.id, id))
    .returning({ id: credentials.id });

  if (!removed.length) return c.json({ error: "no such passkey" }, 404);

  // a revoked passkey must not leave live sessions behind
  await destroyAllSessions();
  return c.json({ ok: true });
});
