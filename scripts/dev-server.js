/**
 * Starts a Vite dev server, or reuses one that is already listening.
 *
 * Shared by the test runner and the preview-image script, because both need a
 * site to point a browser at and neither should stop a server it did not start.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const reachable = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

/** Returns the child to stop later, or null when something was already serving. */
export const ensureServer = async (url) => {
  if (await reachable(url)) {
    console.log(`using the dev server already on ${url}\n`);
    return null;
  }

  console.log("starting a dev server…");
  /* detached so the child gets its own process group. `npm run dev` is a
     wrapper: killing it leaves the vite process it spawned holding the port,
     and the next run finds a stale server it did not start and will not stop. */
  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await reachable(url)) {
      console.log(`dev server up on ${url}\n`);
      return child;
    }
  }

  child.kill();
  throw new Error(`the dev server never came up on ${url}`);
};

export const stopServer = (child) => {
  if (!child) return; // one that was already up is somebody else's
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill();
  }
};

/**
 * Where to find Chrome.
 *
 * `channel: "chrome"` finds the one installed in the usual place, which is what
 * happens on a laptop. CI installs Chrome into a tool cache that Playwright
 * does not know to look in, so it passes the path explicitly.
 */
export const chromeOptions = () =>
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" };
