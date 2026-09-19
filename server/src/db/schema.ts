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

/** The hub's own row. It samples itself, so it has no agent and no key. */
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
    // salted hash, never the raw address
    ipHash: text("ip_hash"),
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (t) => [index("guestbook_created_at_idx").on(t.createdAt)]
);

export type GuestbookEntry = typeof guestbook.$inferSelect;

/** Registered passkeys. One person uses this site, so there is no users table. */
export const credentials = pgTable("credentials", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(), // base64url COSE key
  // a counter that goes backwards means the credential was cloned
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array, a hint for the browser UI
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type Credential = typeof credentials.$inferSelect;

/** Only the SHA-256 of each session token is stored. */
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

/** Single-use tokens for enrolling a passkey, minted with `bun run admin:token`. */
export const bootstrapTokens = pgTable("bootstrap_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type BootstrapToken = typeof bootstrapTokens.$inferSelect;

/** Editable site copy, like the "now building" widget text. */
export const siteStatus = pgTable("site_status", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SiteStatus = typeof siteStatus.$inferSelect;

/** One row per visitor, keyed by the salted IP hash. The row id is the visitor number. */
export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  ipHash: text("ip_hash").notNull().unique(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  visits: integer("visits").notNull().default(1),
});

export type Visitor = typeof visitors.$inferSelect;

/** CPU and memory readings every 30 seconds, pruned to 24 hours. */
export const metricSamples = pgTable(
  "metric_samples",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    server: text("server").notNull().default(HUB_SLUG),
    cpuPct: real("cpu_pct").notNull(),
    memPct: real("mem_pct").notNull(),
    memUsedMb: integer("mem_used_mb").notNull(),
    memTotalMb: integer("mem_total_mb"),
    // null when the agent does not collect it, which is not the same as zero
    diskPct: real("disk_pct"),
    diskUsedGb: real("disk_used_gb"),
    diskTotalGb: real("disk_total_gb"),
    load1: real("load_1"),
  },
  (t) => [index("metric_samples_at_idx").on(t.server, t.at)]
);

export type MetricSample = typeof metricSamples.$inferSelect;

/** Every machine reporting to the hub. Each agent has its own key; the hub row has none. */
export const servers = pgTable("servers", {
  slug: text("slug").primaryKey(), // url-safe id, also what the agent reports as
  name: text("name").notNull(), // display name on the tab
  // SHA-256 of the agent key, null for the hub
  keyHash: text("key_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  agentVersion: text("agent_version"),
  osName: text("os_name"),
  cores: integer("cores"),
  uptimeSeconds: integer("uptime_seconds"),
  // latest systemd snapshot; only the current state matters, so no history table
  units: jsonb("units").$type<UnitState[]>(),
  // units systemd considers failed, watched or not
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

/** HTTP checks. A running nginx does not mean the site behind it responds. */
export const services = pgTable("services", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // free text, not a foreign key, so a service can outlive its server row
  server: text("server"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  ok: boolean("ok"), // null until the first probe lands
  status: integer("status"), // HTTP status, null if the request never got one
  latencyMs: integer("latency_ms"),
  error: text("error"),
  // when the current up/down state began
  since: timestamp("since", { withTimezone: true }),
});

export type Service = typeof services.$inferSelect;

/** Single-use tokens that let one new server enroll and receive its key. */
export const agentEnrollments = pgTable("agent_enrollments", {
  tokenHash: text("token_hash").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: text("used_by"), // the slug it created, for an audit trail
});

export type AgentEnrollment = typeof agentEnrollments.$inferSelect;
