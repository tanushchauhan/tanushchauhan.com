import { installFixtures } from "./fixtures.js";

export const DESKTOP = { width: 1512, height: 950 };

/** An iPhone with Safari's toolbars showing. */
export const PHONE = { width: 393, height: 664 };

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** One window's persisted shape, with every field the store expects. */
export const win = (over = {}) => ({
  isOpen: true,
  isMinimized: false,
  isMaximized: false,
  zIndex: 1001,
  data: null,
  pos: null,
  size: null,
  ...over,
});

/**
 * The persisted store as the app finds it on load. `version` must match the
 * store, and window data is a reference: `{ ref: id }` or `{ ref: id, part: "data" }`.
 */
export const seed = ({ windows = {}, ...rest } = {}) =>
  JSON.stringify({
    state: {
      windows,
      nextZIndex: 1010,
      theme: "light",
      wallpaper: "austin",
      folderPos: {},
      widgetPos: {},
      soundOn: false,
      desktopFolders: [],
      ...rest,
    },
    version: 3,
  });

let open = null;
export const currentPage = () => (open && !open.isClosed() ? open : null);

// screenshots still in flight, so close can wait for them
const pending = new Set();

export const track = (promise) => {
  pending.add(promise);
  promise.finally(() => pending.delete(promise));
};

export const flush = () => Promise.all([...pending]);

/** A page with the API stubbed. The seed is only written into empty storage, so reloads keep state. */
export const openPage = async (
  browser,
  {
    viewport = DESKTOP,
    phone = false,
    authed = true,
    state,
    colorScheme = "light",
    reducedMotion,
    settle = true,
    building,
  } = {}
) => {
  const page = await browser.newPage({
    viewport,
    colorScheme,
    ...(reducedMotion ? { reducedMotion } : {}),
    ...(phone
      ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: IPHONE_UA }
      : {}),
  });

  open = page;

  const close = page.close.bind(page);
  page.close = async () => {
    await flush();
    return close();
  };

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.pageErrors = errors;

  await installFixtures(page, { authed, building });

  if (state) {
    await page.addInitScript((s) => {
      if (!localStorage.getItem("tanushos-v1")) localStorage.setItem("tanushos-v1", s);
    }, state);
  }

  await page.goto(globalThis.__TEST_URL__, { waitUntil: "domcontentloaded" });
  if (settle) await settled(page);
  return page;
};

/** A fixed wait: every app signal tried went true while windows were still animating. */
export const settled = (page) => page.waitForTimeout(3200);

export const storedState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("tanushos-v1")).state);

export const rect = (page, selector) =>
  page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x, y: r.y, w: r.width, h: r.height,
      right: r.right, bottom: r.bottom,
    };
  });

export const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

export const drag = async (page, from, dx, dy, steps = 15) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps });
  await page.mouse.up();
  await page.waitForTimeout(250);
};

/** A few pixels inside the named corner, where the resize handle sits. */
export const corner = (r, dir) => ({
  x: dir.includes("e") ? r.right - 4 : r.x + 4,
  y: dir.includes("s") ? r.bottom - 4 : r.y + 4,
});

export const selection = (page) =>
  page.evaluate(() => document.getSelection().toString().trim());

export const clearSelection = (page) =>
  page.evaluate(() => document.getSelection().removeAllRanges());

export const isSelectable = (page, selector) =>
  page.$eval(selector, (el) => {
    const cs = getComputedStyle(el);
    return (cs.webkitUserSelect || cs.userSelect) !== "none";
  });

/** Selects the word under the pointer. Headless Chrome drags do not always extend a selection. */
export const selectWord = async (page, selector, dx = 40) => {
  const r = await rect(page, selector);
  await clearSelection(page);
  await page.mouse.dblclick(r.x + dx, r.y + Math.min(8, r.h / 2));
  await page.waitForTimeout(220);
  return selection(page);
};

export const runCommand = async (page, line, settle = 700) => {
  await page.click(".term-body");
  await page.keyboard.type(line);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(settle);
  return page.$eval(".term-body", (el) => el.innerText);
};
