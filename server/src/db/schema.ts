import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
