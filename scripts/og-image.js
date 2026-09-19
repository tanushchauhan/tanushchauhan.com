#!/usr/bin/env node
/**
 * Renders public/images/og.png from the live site, signed out.
 *
 *   npm run og                                  shoot the live site
 *   OG_URL=http://localhost:5173 npm run og     shoot a dev server instead
 *
 * Against localhost it borrows the live widget responses, since the dev server
 * has no GITHUB_TOKEN.
 */
import { chromium } from "playwright-core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import path from "node:path";
import { ensureServer, stopServer, chromeOptions } from "./dev-server.js";

const run = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = "https://tanushchauhan.com";
const SITE = process.env.OG_URL ?? LIVE;
const OUT = path.join(ROOT, "public/images/og.png");

// 1200x630 is 1.905:1, so the viewport matches it
const VIEWPORT = { width: 1440, height: 756 };

// drag offsets, not positions
const TERMINAL = { pos: { x: 470, y: 145 }, size: { w: 600, h: 400 } };

const state = JSON.stringify({
  state: {
    windows: {
      terminal: {
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: 1001,
        data: null,
        ...TERMINAL,
      },
    },
    nextZIndex: 1010,
    theme: "light",
    wallpaper: "austin",
    folderPos: {},
    widgetPos: {},
    soundOn: false,
  },
  version: 3,
});

const main = async () => {
  const server = SITE.includes("localhost") ? await ensureServer(SITE) : null;
  const browser = await chromium.launch({ ...chromeOptions(), headless: true });

  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // shot at 2x and scaled down, which beats rendering small
    colorScheme: "light",
  });

  await page.route("**/api/auth/me", (r) => r.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/moontower/fleet", (r) => r.fulfill({ status: 401, json: {} }));

  if (SITE.includes("localhost")) {
    await page.route("**/api/widgets/**", async (route) => {
      const { pathname, search } = new URL(route.request().url());
      try {
        const live = await fetch(LIVE + pathname + search);
        return route.fulfill({
          status: live.status,
          contentType: "application/json",
          body: await live.text(),
        });
      } catch {
        return route.continue();
      }
    });
  }

  await page.addInitScript((s) => {
    sessionStorage.setItem("booted", "1"); // skip the boot animation
    localStorage.setItem("tanushos-v1", s);
  }, state);

  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // widgets load, the window finishes flying in

  await page.click(".term-body");
  await page.keyboard.type("neofetch");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.activeElement?.blur()); // no caret in the shot
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);

  await page.screenshot({ path: OUT });
  await browser.close();
  stopServer(server);

  await run("sips", ["-z", "630", "1200", OUT, "--out", OUT]);
  const { size } = await stat(OUT);
  console.log(`${path.relative(ROOT, OUT)}  1200x630  ${(size / 1024).toFixed(0)}kb`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
