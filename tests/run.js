#!/usr/bin/env node
/**
 * Runs the specs with playwright-core and the system Chrome.
 *
 *   npm test                 every spec, starting a dev server if none is up
 *   npm test -- windows      only specs whose name contains "windows"
 *   npm test -- --headed     watch it happen
 */
import { chromium } from "playwright-core";
import { readdir, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ensureServer, stopServer, chromeOptions } from "../scripts/dev-server.js";
import { currentPage, track, flush } from "./lib/harness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.TEST_URL ?? "http://localhost:5173";
const SHOTS = path.join(HERE, "screenshots");

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const args = process.argv.slice(2);
const headed = args.includes("--headed");
const filters = args.filter((a) => !a.startsWith("--"));

const main = async () => {
  const files = (await readdir(path.join(HERE, "specs")))
    .filter((f) => f.endsWith(".js"))
    .filter((f) => !filters.length || filters.some((q) => f.includes(q)))
    .sort();

  if (!files.length) {
    console.error(filters.length ? `no specs match ${filters.join(", ")}` : "no specs found");
    process.exit(1);
  }

  const server = await ensureServer(URL);
  globalThis.__TEST_URL__ = URL;

  await rm(SHOTS, { recursive: true, force: true });
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch({ ...chromeOptions(), headless: !headed });
  const failures = [];
  let passed = 0;
  const started = Date.now();

  for (const file of files) {
    const spec = await import(path.join(HERE, "specs", file));
    const label = spec.name ?? file;
    console.log(`\n\x1b[1m${label}\x1b[0m`);

    // every failure is screenshotted
    const capture = (name) => {
      const page = currentPage();
      if (!page) return;
      const dest = path.join(SHOTS, `${slug(label)}--${slug(name)}.png`);
      track(
        page
          .screenshot({ path: dest })
          .catch(() => {})
      );
    };

    const t = {
      check(name, ok, detail = "") {
        const line = `  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`;
        console.log(detail ? `${line}  \x1b[2m${detail}\x1b[0m` : line);
        if (ok) return void passed++;
        failures.push(`${label}: ${name}${detail ? `  (${detail})` : ""}`);
        capture(name);
      },
      note(text) {
        console.log(`  \x1b[2m${text}\x1b[0m`);
      },
    };

    try {
      await spec.run({ browser, t });
    } catch (error) {
      console.log(`  \x1b[31m✗\x1b[0m threw: ${error.message}`);
      failures.push(`${label}: threw ${error.message}`);
      capture("threw");
    }

    await flush();
  }

  await browser.close();
  stopServer(server);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n${passed} passed, ${failures.length} failed, ${seconds}s\n` +
      failures.map((f) => `  \x1b[31m✗\x1b[0m ${f}`).join("\n") +
      (failures.length ? `\n\nscreenshots in ${path.relative(process.cwd(), SHOTS)}/` : "")
  );
  process.exit(failures.length ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
