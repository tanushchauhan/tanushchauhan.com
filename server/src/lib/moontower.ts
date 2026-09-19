import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { agentEnrollments, servers, HUB_SLUG } from "../db/schema.ts";

/**
 * Moontower, the fleet monitor, named for Austin's moonlight towers.
 *
 * An agent's key can only post readings for its own server. The hub's reply is
 * configuration and a version number, never anything the agent executes, so a
 * compromise of this site does not reach the enrolled machines.
 */

export const AGENT_VERSION = "1.2.0";

export const STALE_AFTER_MS = 3 * 60 * 1000;

const ENROLLMENT_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "mt_";
const ENROLL_PREFIX = "mt_enroll_";

/** Agents ignore collector names they do not know, so older agents still work. */
export const COLLECTORS = ["cpu", "memory", "disk", "load", "units"] as const;
export type Collector = (typeof COLLECTORS)[number];

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
};

const randomToken = (prefix: string) => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return prefix + Buffer.from(bytes).toString("base64url");
};

export const normaliseSlug = (raw: string) =>
  raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

/* ---------- enrollment ---------- */

/** Mints a single-use token for the install one-liner. Returns it once. */
export const mintEnrollmentToken = async () => {
  const token = randomToken(ENROLL_PREFIX);
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);
  await db.insert(agentEnrollments).values({ tokenHash: await hash(token), expiresAt });
  return { token, expiresAt };
};

/** Registers a server and returns its key. The token is spent only after the row is written. */
export const enrollServer = async (token: string, slugRaw: string, name: string, meta: {
  agentVersion?: string;
  osName?: string;
  cores?: number;
}) => {
  const tokenHash = await hash(token);

  const [enrollment] = await db
    .select()
    .from(agentEnrollments)
    .where(
      and(
        eq(agentEnrollments.tokenHash, tokenHash),
        isNull(agentEnrollments.usedAt),
        gt(agentEnrollments.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!enrollment) return { ok: false as const, error: "enrollment token is invalid or expired" };

  const slug = normaliseSlug(slugRaw);
  if (!slug) return { ok: false as const, error: "name must contain a letter or digit" };
  if (slug === HUB_SLUG) return { ok: false as const, error: `"${HUB_SLUG}" is reserved for the hub itself` };

  const [existing] = await db.select().from(servers).where(eq(servers.slug, slug)).limit(1);
  if (existing) return { ok: false as const, error: `a server named "${slug}" is already enrolled` };

  const key = randomToken(KEY_PREFIX);
  await db.insert(servers).values({
    slug,
    name: name.trim().slice(0, 48) || slug,
    keyHash: await hash(key),
    agentVersion: meta.agentVersion ?? null,
    osName: meta.osName?.slice(0, 120) ?? null,
    cores: meta.cores ?? null,
  });

  await db
    .update(agentEnrollments)
    .set({ usedAt: new Date(), usedBy: slug })
    .where(eq(agentEnrollments.tokenHash, tokenHash));

  return { ok: true as const, slug, key };
};

/* ---------- reporting ---------- */

/** The hub has no key, so nothing from the network can write rows as the hub. */
export const serverForKey = async (key: string | undefined) => {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const [row] = await db.select().from(servers).where(eq(servers.keyHash, await hash(key))).limit(1);
  return row && row.slug !== HUB_SLUG ? row : null;
};

/** What the hub tells an agent to do next. Data only, never code. */
export const configFor = (server: { slug: string }) => ({
  collect: COLLECTORS,
  intervalSeconds: 30,
  // the agent only prints this; upgrading is always a manual reinstall
  latestVersion: AGENT_VERSION,
});

export const registerHub = async (cores: number, osName: string) => {
  await db
    .insert(servers)
    .values({ slug: HUB_SLUG, name: "Hub", cores, osName })
    .onConflictDoUpdate({
      target: servers.slug,
      set: { cores, osName, lastSeenAt: new Date() },
    });
};
