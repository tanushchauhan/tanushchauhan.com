import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { bootstrapTokens } from "../db/schema.ts";

const TTL_MS = 15 * 60 * 1000;

const sha256 = (value: string) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

/**
 * Mints a one-time token that authorizes enrolling a passkey. Returns the
 * plaintext exactly once; only its hash is stored, so a lost token cannot be
 * recovered, only reissued.
 */
export const mintBootstrapToken = async () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Buffer.from(bytes).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.insert(bootstrapTokens).values({ tokenHash: sha256(token), expiresAt });
  await db.delete(bootstrapTokens).where(lt(bootstrapTokens.expiresAt, new Date()));

  return { token, expiresAt };
};

const liveToken = (token: string) =>
  and(
    eq(bootstrapTokens.tokenHash, sha256(token)),
    isNull(bootstrapTokens.usedAt),
    gt(bootstrapTokens.expiresAt, new Date())
  );

/**
 * Is this token currently usable? Checked when issuing a challenge, so that a
 * failed or abandoned Touch ID prompt does not burn the token and force the
 * user to shell back in for another one.
 */
export const bootstrapTokenIsValid = async (token: string | undefined) => {
  if (!token) return false;
  const rows = await db
    .select({ tokenHash: bootstrapTokens.tokenHash })
    .from(bootstrapTokens)
    .where(liveToken(token))
    .limit(1);
  return rows.length > 0;
};

/**
 * Marks a token used and reports whether it was valid, called only once a
 * passkey has actually been proven. Filtering the update on used_at being null
 * means a concurrent second attempt updates zero rows and is rejected, rather
 * than both attempts reading "unused" and both succeeding.
 */
export const consumeBootstrapToken = async (token: string | undefined) => {
  if (!token) return false;

  const updated = await db
    .update(bootstrapTokens)
    .set({ usedAt: new Date() })
    .where(liveToken(token))
    .returning({ tokenHash: bootstrapTokens.tokenHash });

  return updated.length > 0;
};
