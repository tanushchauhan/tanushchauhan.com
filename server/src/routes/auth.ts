import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { and, desc, eq, gt, isNull, like } from "drizzle-orm";
import { db } from "../db/index.ts";
import { bootstrapTokens, credentials } from "../db/schema.ts";
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

// allows a cancelled Touch ID prompt and a few retries
const ceremonyLimiter = rateLimit({ limit: 20, windowMs: 10 * 60 * 1000 });

// /me runs on every page load, so it gets its own looser budget
const readLimiter = rateLimit({ limit: 120, windowMs: 10 * 60 * 1000 });

// ties a browser to the challenge it was issued
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

// anything not listed here gets the strict budget
const LOOSE = new Set(["/me", "/passkeys", "/tokens"]);

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

authRoutes.get("/me", async (c) => {
  const session = await readSession(c);
  const total = await countCredentials();

  if (!session) {
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
 * Enrolling a passkey needs an existing session or a bootstrap token from
 * `bun run admin:token`. There is no open registration, even before the first
 * passkey exists.
 */
const mayRegister = async (c: Context, token: string | undefined) =>
  Boolean(await readSession(c)) || bootstrapTokenIsValid(token);

authRoutes.post("/register/options", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  // checked, not consumed, so a cancelled prompt keeps the token usable
  if (!(await mayRegister(c, body?.bootstrapToken))) {
    return c.json({ error: "not authorized to register a passkey" }, 403);
  }

  const challengeId = newChallengeId();
  const options = await registrationOptions(challengeId);
  setChallengeCookie(c, challengeId);
  return c.json(options);
});

// authorize, verify, then consume the token, and only then save the credential
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

  if (!usingSession && !(await consumeBootstrapToken(body?.bootstrapToken))) {
    return c.json({ error: "enrollment token was already used" }, 403);
  }

  const credentialId = await saveCredential(result.record);

  // registering also signs you in
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

/* ---------- passkey management ---------- */

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
  // removing the last one would lock the account out
  if (total <= 1) {
    return c.json({ error: "cannot remove the only passkey" }, 409);
  }

  const id = c.req.param("id");
  const removed = await db
    .delete(credentials)
    .where(eq(credentials.id, id))
    .returning({ id: credentials.id });

  if (!removed.length) return c.json({ error: "no such passkey" }, 404);

  await destroyAllSessions();
  return c.json({ ok: true });
});

/* ---------- outstanding enrollment tokens ----------
 * A minted token that was never used is invisible until it expires, so these
 * list the live ones and let one be revoked early. */

authRoutes.get("/tokens", requireAuth, async (c) => {
  const rows = await db
    .select({
      tokenHash: bootstrapTokens.tokenHash,
      createdAt: bootstrapTokens.createdAt,
      expiresAt: bootstrapTokens.expiresAt,
    })
    .from(bootstrapTokens)
    .where(and(isNull(bootstrapTokens.usedAt), gt(bootstrapTokens.expiresAt, new Date())))
    .orderBy(desc(bootstrapTokens.createdAt));

  // the hash, not the token: the plaintext is shown once and never stored
  return c.json({
    tokens: rows.map(({ tokenHash, ...rest }) => ({ id: tokenHash.slice(0, 8), ...rest })),
  });
});

authRoutes.delete("/tokens/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f]{4,64}$/.test(id)) return c.json({ error: "not a token id" }, 400);

  const removed = await db
    .delete(bootstrapTokens)
    .where(and(isNull(bootstrapTokens.usedAt), like(bootstrapTokens.tokenHash, `${id}%`)))
    .returning({ tokenHash: bootstrapTokens.tokenHash });

  if (!removed.length) return c.json({ error: `no live token starting ${id}` }, 404);
  return c.json({ revoked: removed.length });
});
