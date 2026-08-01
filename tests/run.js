#!/usr/bin/env node
/**
 * The test runner.
 *
 * Built on playwright-core and the system Chrome rather than @playwright/test,
 * which is a deliberate trade: the test runner package downloads its own
 * browser builds on install, and this suite is not worth half a gigabyte on
 * every checkout. What we give up is parallelism and a reporter, neither of
 * which a suite this size misses.
 *
 *   npm test                 every spec, starting a dev server if none is up
 *   npm test -- windows      only specs whose name contains "windows"
 *   npm test -- --headed     watch it happen
 *
 * A dev server already listening on 5173 is reused and left running.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.TEST_URL ?? "http://localhost:5173";

const args = process.argv.slice(2);
const headed = args.includes("--headed");
const filters = args.filter((a) => !a.startsWith("--"));

const reachable = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

/** Starts `vite` and waits for it, unless something is already serving. */
const ensureServer = async () => {
  if (await reachable(URL)) {
    console.log(`using the dev server already on ${URL}\n`);
    return null;
  }

  console.log("starting a dev server…");
  /* detached so the child gets its own process group. `npm run dev` is a
     wrapper: killing it leaves the vite process it spawned holding the port,
     and the next run finds a stale server it did not start and will not stop. */
  const child = spawn("npm", ["run", "dev"], {
    cwd: path.join(HERE, ".."),
    stdio: "ignore",
    detached: true,
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await reachable(URL)) {
      console.log(`dev server up on ${URL}\n`);
      return child;
    }
  }

  child.kill();
  throw new Error(`the dev server never came up on ${URL}`);
};

const main = async () => {
  const files = (await readdir(path.join(HERE, "specs")))
    .filter((f) => f.endsWith(".js"))
    .filter((f) => !filters.length || filters.some((q) => f.includes(q)))
    .sort();

  if (!files.length) {
    console.error(filters.length ? `no specs match ${filters.join(", ")}` : "no specs found");
    process.exit(1);
  }

  const server = await ensureServer();
  globalThis.__TEST_URL__ = URL;

  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  const failures = [];
  let passed = 0;
  const started = Date.now();

  for (const file of files) {
    const spec = await import(path.join(HERE, "specs", file));
    console.log(`\n\x1b[1m${spec.name ?? file}\x1b[0m`);

    // one collector per spec, so a failure names the spec it came from
    const t = {
      check(name, ok, detail = "") {
        const line = `  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`;
        console.log(detail ? `${line}  \x1b[2m${detail}\x1b[0m` : line);
        if (ok) passed++;
        else failures.push(`${spec.name ?? file}: ${name}${detail ? `  (${detail})` : ""}`);
      },
      note(text) {
        console.log(`  \x1b[2m${text}\x1b[0m`);
      },
    };

    try {
      await spec.run({ browser, t });
    } catch (error) {
      // a spec that throws is a failure, not a reason to abandon the rest
      console.log(`  \x1b[31m✗\x1b[0m threw: ${error.message}`);
      failures.push(`${spec.name ?? file}: threw ${error.message}`);
    }
  }

  await browser.close();
  // only a server this run started: one that was already up is somebody's
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill();
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n${passed} passed, ${failures.length} failed, ${seconds}s\n` +
      failures.map((f) => `  \x1b[31m✗\x1b[0m ${f}`).join("\n")
  );
  process.exit(failures.length ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
