/**
 * Break-glass: prints a one-time token that authorizes enrolling a passkey.
 *
 *   docker exec -it <container> bun server/src/admin/token.ts
 *
 * Run this to enrol the very first passkey, and again if access to every
 * registered passkey is ever lost. It requires shell access to the container,
 * which is the point: it is the one path in that does not depend on holding a
 * credential, so it must not be reachable over HTTP.
 *
 * Invoked by path rather than `bun run admin:token` because the runtime image
 * has WORKDIR /app while package.json lives in /app/server, so `bun run` finds
 * no scripts. `cd server && bun run admin:token` works too.
 *
 * It deliberately imports nothing from auth/webauthn.ts. That module refuses to
 * load in production until RP_ID and ORIGIN are set to the real domain, and a
 * recovery tool that only works once the config is already correct is no
 * recovery tool at all. All it needs is a database.
 */
import { count } from "drizzle-orm";
import { mintBootstrapToken } from "../auth/bootstrap.ts";
import { closeDb, db } from "../db/index.ts";
import { credentials } from "../db/schema.ts";

const { token, expiresAt } = await mintBootstrapToken();
const [{ value: existing } = { value: 0 }] = await db
  .select({ value: count() })
  .from(credentials);

const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

console.log("");
console.log(`  Enrollment token (single use, expires in ${minutes} minutes):`);
console.log("");
console.log(`    ${token}`);
console.log("");
console.log(
  existing === 0
    ? "  No passkeys registered yet. On the site, open the terminal and run:"
    : `  ${existing} passkey(s) already registered. To add another, run:`
);
console.log("");
console.log(`    enroll ${token}`);
console.log("");

await closeDb();
