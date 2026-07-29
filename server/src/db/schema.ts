import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** The machine this hub runs on. It reports itself, so it needs no agent. */
export const HUB_SLUG = "hub";

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

/**
 * Registered passkeys. There is exactly one human behind this site, so there is
 * no users table: every credential here is mine, and holding any one of them is
 * what it means to be logged in.
 */
export const credentials = pgTable("credentials", {
  // the raw credential ID, base64url encoded, as the authenticator reports it
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(), // base64url COSE key
  // bumped by authenticators that implement it; a value that goes backwards
  // means the credential was cloned
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array, a hint for the browser UI
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type Credential = typeof credentials.$inferSelect;

/**
 * Server-side session records. The cookie carries a random token and this table
 * stores only its SHA-256, so a database leak cannot be replayed as a login.
 * Rows exist so a session can be revoked, which a stateless JWT could not do.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    credentialId: text("credential_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_expires_at_idx").on(t.expiresAt)]
);

export type Session = typeof sessions.$inferSelect;

/**
 * Break-glass tokens for enrolling a passkey when no usable one exists, minted
 * from inside the container with `bun run admin:token`. Without this, losing
 * access to iCloud Keychain would mean losing the admin surface permanently.
 * Only the hash is stored, single use, short lived.
 */
export const bootstrapTokens = pgTable("bootstrap_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type BootstrapToken = typeof bootstrapTokens.$inferSelect;

/**
 * Small pieces of hand-edited site copy, so changing what the "now building"
 * widget says is a terminal command rather than a commit and a redeploy.
 * A key/value table rather than a column per field, because the alternative is
 * a migration every time a widget wants one more line of text.
 */
export const siteStatus = pgTable("site_status", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SiteStatus = typeof siteStatus.$inferSelect;

/**
 * A rolling day of CPU and memory readings, taken every 30 seconds. Kept in
 * Postgres rather than in memory so the sparklines survive a redeploy, which
 * is exactly when I am most likely to be looking at them.
 *
 * Pruned to 24 hours by the sampler: this is a chart nobody will scroll back
 * through, so an unbounded table would be all cost and no benefit.
 */
export const metricSamples = pgTable(
  "metric_samples",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    // which machine this reading came from; "hub" samples itself in-process,
    // everything else arrives from a Moontower agent
    server: text("server").notNull().default(HUB_SLUG),
    cpuPct: real("cpu_pct").notNull(),
    memPct: real("mem_pct").notNull(),
    memUsedMb: integer("mem_used_mb").notNull(),
    // total is per server, not a constant: the box a reading came from is the
    // only thing that knows how much memory it has
    memTotalMb: integer("mem_total_mb"),
    // optional collectors. Null means "this agent was not asked for it", which
    // is a different thing from zero and has to render differently.
    diskPct: real("disk_pct"),
    diskUsedGb: real("disk_used_gb"),
    diskTotalGb: real("disk_total_gb"),
    load1: real("load_1"),
  },
  (t) => [index("metric_samples_at_idx").on(t.server, t.at)]
);

export type MetricSample = typeof metricSamples.$inferSelect;

/**
 * Every machine reporting into the hub, including this one.
 *
 * "hub" is a row like any other so the card has nothing special-cased in it,
 * but it has no key: it samples itself in-process and there is no credential to
 * steal. Agent-backed servers each hold their own key, so one compromised box
 * cannot impersonate another, and revoking it is deleting one row.
 */
export const servers = pgTable("servers", {
  slug: text("slug").primaryKey(), // url-safe id, also what the agent reports as
  name: text("name").notNull(), // display name on the tab
  // null for hub. SHA-256 of the key, never the key itself, so a database leak
  // cannot be replayed as a reporting credential
  keyHash: text("key_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // how staleness is decided: no report in a few minutes and the tab greys out
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  agentVersion: text("agent_version"),
  osName: text("os_name"),
  cores: integer("cores"),
  uptimeSeconds: integer("uptime_seconds"),
  // Latest systemd snapshot from this machine's agent. A column rather than a
  // table because unit state has no history worth keeping: what matters is what
  // is broken now, and NRestarts already carries "how often has this flapped"
  // without me storing a row every 30 seconds to derive it.
  units: jsonb("units").$type<UnitState[]>(),
  // how many units systemd itself considers failed, watched or not. One number
  // that catches everything the watchlist does not name.
  failedUnits: integer("failed_units"),
});

export type Server = typeof servers.$inferSelect;

/** One systemd unit as the agent found it. Short keys: this rides in every report. */
export type UnitState = {
  n: string; // unit name, e.g. "nginx.service"
  a: string; // ActiveState: active | inactive | failed | activating
  s: string; // SubState: running | exited | dead
  r: number; // NRestarts
};

/**
 * Applications the hub probes over HTTP.
 *
 * Deliberately separate from the systemd units above, because they answer
 * different questions. A unit tells you nginx is running; only a request tells
 * you the site behind it returns a page. Both fail independently and the
 * interesting outage is the one where the units are all green.
 */
export const services = pgTable("services", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // which machine it lives on, for grouping on the card. Free text, and not a
  // foreign key: a service can outlive the server row it was tagged with, and
  // losing the label is better than the delete failing.
  server: text("server"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  ok: boolean("ok"), // null until the first probe lands
  status: integer("status"), // HTTP status, null if the request never got one
  latencyMs: integer("latency_ms"),
  error: text("error"),
  // when the current up/down state began, so the card can say "down for 12m"
  // rather than just "down". Only moves when the state flips.
  since: timestamp("since", { withTimezone: true }),
});

export type Service = typeof services.$inferSelect;

/**
 * Single-use tokens that buy exactly one thing: the right to register one new
 * server and receive its long-lived key. Same shape as the passkey bootstrap
 * tokens, and for the same reason: the install one-liner has to carry a secret,
 * and a short-lived single-use one is far less dangerous to paste around than
 * the reporting key itself.
 */
export const agentEnrollments = pgTable("agent_enrollments", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: text("used_by"), // the slug it created, for an audit trail
});

export type AgentEnrollment = typeof agentEnrollments.$inferSelect;
