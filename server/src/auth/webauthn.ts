import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { credentials } from "../db/schema.ts";

/** Passkeys are bound to the origin, so bad values should fail at startup. */
export const rpID = Bun.env.RP_ID ?? "localhost";
export const origin = Bun.env.ORIGIN ?? "http://localhost:3001";
export const rpName = "tanushchauhan.com";

if (Bun.env.NODE_ENV === "production" && (rpID === "localhost" || origin.startsWith("http://"))) {
  throw new Error(
    `RP_ID and ORIGIN must be set to the real domain in production (got RP_ID=${rpID}, ORIGIN=${origin})`
  );
}

// must never change, or every registered passkey is orphaned
const USER_ID = new TextEncoder().encode("tanush");
const USER_NAME = "tanush@utexas.edu";

/* ---------- challenge store ----------
 * In memory: challenges are short lived and single use, and the app runs as
 * one container.
 */
type Pending = { challenge: string; expiresAt: number };
const pending = new Map<string, Pending>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pending) if (value.expiresAt <= now) pending.delete(key);
}, CHALLENGE_TTL_MS).unref?.();

export const newChallengeId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
};

const putChallenge = (id: string, challenge: string) => {
  pending.set(id, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
};

/** Single use: taking a challenge removes it, so a response cannot be replayed. */
const takeChallenge = (id: string | undefined) => {
  if (!id) return null;
  const found = pending.get(id);
  pending.delete(id);
  if (!found || found.expiresAt <= Date.now()) return null;
  return found.challenge;
};

export const countCredentials = async () => {
  const rows = await db.select({ id: credentials.id }).from(credentials);
  return rows.length;
};

/* ---------- registration ---------- */

export const registrationOptions = async (challengeId: string) => {
  const existing = await db.select().from(credentials);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: USER_ID,
    userName: USER_NAME,
    userDisplayName: "Tanush Chauhan",
    attestationType: "none",
    authenticatorSelection: {
      // discoverable credentials, so login needs no username
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
    excludeCredentials: existing.map((cred) => ({
      id: cred.id,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    })),
  });

  putChallenge(challengeId, options.challenge);
  return options;
};

/** Verifies a registration and returns the row to save, without saving it. */
export const verifyRegistration = async (
  challengeId: string | undefined,
  response: RegistrationResponseJSON,
  nickname: string
) => {
  const expectedChallenge = takeChallenge(challengeId);
  if (!expectedChallenge) return { ok: false as const, error: "challenge expired, try again" };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false as const, error: "registration could not be verified" };
  }

  const { credential } = verification.registrationInfo;

  return {
    ok: true as const,
    record: {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: response.response.transports
        ? JSON.stringify(response.response.transports)
        : null,
      nickname,
    },
  };
};

/** Persists a verified credential. Idempotent, so a retried write is harmless. */
export const saveCredential = async (
  record: NonNullable<Awaited<ReturnType<typeof verifyRegistration>>["record"]>
) => {
  await db.insert(credentials).values(record).onConflictDoNothing();
  return record.id;
};

/* ---------- authentication ---------- */

export const authenticationOptions = async (challengeId: string) => {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: [],
  });

  putChallenge(challengeId, options.challenge);
  return options;
};

export const verifyAuthentication = async (
  challengeId: string | undefined,
  response: AuthenticationResponseJSON
) => {
  const expectedChallenge = takeChallenge(challengeId);
  if (!expectedChallenge) return { ok: false as const, error: "challenge expired, try again" };

  const [stored] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, response.id))
    .limit(1);

  if (!stored) return { ok: false as const, error: "unknown passkey" };

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.counter,
        transports: stored.transports ? JSON.parse(stored.transports) : undefined,
      },
    });
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }

  if (!verification.verified) {
    return { ok: false as const, error: "authentication could not be verified" };
  }

  await db
    .update(credentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(credentials.id, stored.id));

  return { ok: true as const, credentialId: stored.id };
};
