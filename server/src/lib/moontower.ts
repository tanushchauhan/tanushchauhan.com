import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { agentEnrollments, servers, HUB_SLUG } from "../db/schema.ts";

/**
 * Moontower: the fleet reporting system.
 *
 * Named for Austin's moonlight towers, which is apt enough: a scattering of
 * small fixed things, each lighting up one part of the city.
 *
 * The security posture, stated once so the rest of the code can be read against
 * it. Agents hold a per-server key and can do exactly one thing with it, post
 * readings for their own server. There is no channel from the hub to an agent
 * that can execute anything: the hub's reply is configuration (which collectors
 * to run, how often) and a version number the agent only prints. That is
 * deliberate. An auto-updating agent would mean a compromise of this website
 * becomes root on every machine that ever enrolled, which is far too much
 * authority for a portfolio site to hold over a mail server.
 */

export const AGENT_VERSION = "1.1.0";

/** How long without a report before a server is shown as stale rather than live. */
export const STALE_AFTER_MS = 3 * 60 * 1000;

const ENROLLMENT_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "mt_";
const ENROLL_PREFIX = "mt_enroll_";

/**
 * The collector menu. Adding a metric to a server is a config change here and
 * in its row, never a code push to the machine. Agents ignore names they do not
 * recognise, so an older agent degrades to fewer metrics instead of breaking.
 */
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

/** Slugs land in URLs, tab labels and log lines, so keep them boring. */
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

/**
 * Registers a server and hands back its long-lived key. The enrollment token is
 * burned only once the server row is safely written, so a failure here leaves
 * the token usable rather than stranding you with a spent token and no server.
 */
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

/**
 * Resolves a bearer key to its server. Hub is excluded on purpose: it has no
 * key, and nothing arriving over the network should ever be able to write rows
 * attributed to the machine the hub itself is measuring.
 */
export const serverForKey = async (key: string | undefined) => {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const [row] = await db.select().from(servers).where(eq(servers.keyHash, await hash(key))).limit(1);
  return row && row.slug !== HUB_SLUG ? row : null;
};

/** What the hub tells an agent to do next. Data only, never code. */
export const configFor = (server: { slug: string }) => ({
  collect: COLLECTORS,
  intervalSeconds: 30,
  // the agent prints this when it differs from its own; upgrading is always a
  // human re-running the installer, never something the hub can trigger
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
