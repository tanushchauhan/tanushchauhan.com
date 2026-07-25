/**
 * Break-glass: prints a one-time token that authorizes enrolling a passkey.
 *
 *   docker exec -it <container> bun run admin:token
 *
 * Run this to enrol the very first passkey, and again if access to every
 * registered passkey is ever lost. It requires shell access to the container,
 * which is the point: it is the one path in that does not depend on holding a
 * credential, so it must not be reachable over HTTP.
 */
import { mintBootstrapToken } from "../auth/bootstrap.ts";
import { closeDb } from "../db/index.ts";
import { countCredentials } from "../auth/webauthn.ts";

const { token, expiresAt } = await mintBootstrapToken();
const existing = await countCredentials();

const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

console.log("");
console.log("  Enrollment token (single use, expires in " + minutes + " minutes):");
console.log("");
console.log("    " + token);
console.log("");
console.log(
  existing === 0
    ? "  No passkeys registered yet. On the site, open the terminal and run:"
    : `  ${existing} passkey(s) already registered. To add another, run:`
);
console.log("");
console.log("    enroll " + token);
console.log("");

await closeDb();
