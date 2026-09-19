/**
 * Mints a single-use Moontower enrollment token and prints the install command.
 *
 *   docker exec -it <container> bun server/src/admin/enroll.ts
 */
import { closeDb } from "../db/index.ts";
import { mintEnrollmentToken } from "../lib/moontower.ts";

const origin = Bun.env.ORIGIN ?? "https://tanushchauhan.com";
const { token, expiresAt } = await mintEnrollmentToken();

const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

console.log(`
Moontower enrollment token (single use, expires in ${minutes} minutes):

  ${token}

Run this on the server you want to add, replacing the name:

  curl -fsSL ${origin}/moontower/install.sh | sh -s -- \\
      --token ${token} \\
      --name "vps"

The agent runs as its own unprivileged user and only reads /proc, so it does
not need root beyond the install step itself. Read the script first if you like:

  curl -fsSL ${origin}/moontower/install.sh | less
`);

await closeDb();
