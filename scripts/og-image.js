#!/usr/bin/env node
/**
 * Renders the social preview image: public/images/og.png.
 *
 *   npm run og                                  shoot the live site
 *   OG_URL=http://localhost:5173 npm run og     shoot a dev server instead
 *
 * The card is a real screenshot rather than a designed graphic, because the
 * thing being previewed is what the site looks like. Two things follow from
 * that:
 *
 * It shoots production by default. The dev server has no GITHUB_TOKEN and
 * nothing in `building`, so its widgets render empty states and the preview
 * would advertise "Set GITHUB_TOKEN to light this up". Pointed at localhost it
 * borrows the live site's widget responses instead, which is what you want when
 * the copy has changed locally but has not deployed yet: the card then shows
 * the new build with real numbers in it. Both endpoints are public.
 *
 * It shoots signed out, so the image is the desktop a visitor gets: no fleet
 * card, no server names, no disk numbers.
 *
 * Rerun it after anything that changes the desktop's furniture, and remember
 * the scrapers cache hard. Facebook and LinkedIn keep the old image for days
 * unless you run their URL debuggers by hand.
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

/* 1200x630 is 1.905:1, so the viewport has to be that shape or the desktop
   gets letterboxed. 1440 wide is a laptop the layout was designed against, and
   it leaves a gap between the widget block and the project folders that the
   terminal fits into without covering either. */
const VIEWPORT = { width: 1440, height: 756 };

/* Windows carry a drag offset, not a position, so these are nudges away from
   where the window would open on its own. Reshooting at another size means
   re-picking them. */
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
  version: 2,
});

const main = async () => {
  // only when pointed at localhost: nothing to start for the live site
  const server = SITE.includes("localhost") ? await ensureServer(SITE) : null;
  const browser = await chromium.launch({ ...chromeOptions(), headless: true });

  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // shot at 2x and scaled down, which beats rendering small
    colorScheme: "light",
  });

  await page.route("**/api/auth/me", (r) => r.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/moontower/fleet", (r) => r.fulfill({ status: 401, json: {} }));

  // a local dev server has neither a GITHUB_TOKEN nor a `building` row, so let
  // the live site answer for the widgets and keep the local build's markup
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
        return route.continue(); // fall back to the empty state rather than fail
      }
    });
  }

  await page.addInitScript((s) => {
    sessionStorage.setItem("booted", "1"); // skip the boot animation
    localStorage.setItem("tanushos-v1", s);
  }, state);

  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000); // widgets load, the window finishes flying in

  // neofetch, because an empty terminal in the preview says less than a full one
  await page.click(".term-body");
  await page.keyboard.type("neofetch");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.activeElement?.blur()); // no caret in the shot
  await page.mouse.move(0, 0); // and nothing left hovered
  await page.waitForTimeout(400);

  await page.screenshot({ path: OUT });
  await browser.close();
  stopServer(server);

  // 2880x1512 until this brings it down
  await run("sips", ["-z", "630", "1200", OUT, "--out", OUT]);
  const { size } = await stat(OUT);
  console.log(`${path.relative(ROOT, OUT)}  1200x630  ${(size / 1024).toFixed(0)}kb`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
