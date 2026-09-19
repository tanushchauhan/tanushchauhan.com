/**
 * Prints a one-time token for enrolling a passkey, for the first passkey or
 * when every passkey is lost. Needs shell access by design.
 *
 *   docker exec -it <container> bun server/src/admin/token.ts
 *
 * It does not import auth/webauthn.ts, which refuses to load without RP_ID and
 * ORIGIN, so it still works when that config is wrong.
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
