import { installFixtures } from "./fixtures.js";

export const DESKTOP = { width: 1512, height: 950 };

/**
 * An iPhone with Safari's toolbars on screen. That is the height that matters:
 * the full 393x852 is what you get only after the toolbars hide, and laying the
 * home page out for it is what made the page scroll instead of swipe.
 */
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
 * The persisted store, as the app will find it on load. `version` has to match
 * the store's current version or the migration runs and drops things.
 *
 * A window's `data` is stored as a reference into src/constants, not as a copy
 * of what it holds, so seeding one means `{ ref: "<node id>" }` for a folder
 * and `{ ref: "<node id>", part: "data" }` for a file's contents.
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

/* The page a spec is working in, so the runner can photograph a failure without
   every check having to be handed one. Specs open pages one at a time. */
let open = null;
export const currentPage = () => (open && !open.isClosed() ? open : null);

/* Work that has to finish before the page it concerns goes away. `t.check` is
   synchronous and specs do not await it, so a screenshot of a failure is still
   being taken when the spec reaches its `page.close()`. Tracking it here lets
   close wait, which is the only reason any of this needs to exist. */
const pending = new Set();

export const track = (promise) => {
  pending.add(promise);
  promise.finally(() => pending.delete(promise));
};

export const flush = () => Promise.all([...pending]);

/**
 * A page with the API stubbed and the store seeded.
 *
 * The seed is written only when localStorage is empty, because an init script
 * runs on every navigation: writing unconditionally would wipe the very state a
 * reload is meant to prove was persisted.
 */
export const openPage = async (
  browser,
  { viewport = DESKTOP, phone = false, authed = true, state, colorScheme = "light", building } = {}
) => {
  const page = await browser.newPage({
    viewport,
    colorScheme,
    ...(phone
      ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: IPHONE_UA }
      : {}),
  });

  open = page; // before the navigation, so a page that fails to load is still photographable

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
  await settled(page);
  return page;
};

/**
 * Waits for the desktop to finish arranging itself.
 *
 * A fixed wait, deliberately. I tried keying it off the app's own signals: the
 * boot screen leaving, the fit ladder setting data-fit, the window tweens
 * reaching opacity 1. Every version of that condition went true while windows
 * were still flying in, so a resize handle four pixels inside a corner that was
 * still moving was a handle the test missed, and the failures looked like
 * product bugs rather than timing. A suite you run before pushing can afford
 * three seconds a page; it cannot afford lying to you.
 */
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

/** Press, move, release. Used for both dragging things and selecting text. */
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

/**
 * Selects the word under the pointer.
 *
 * Preferred over a dragged selection when all we need to know is whether a
 * region is selectable at all: in headless Chrome a synthesized drag does not
 * always extend a selection inside a block element, even where the caret
 * resolves at both ends and a real browser behaves.
 */
export const selectWord = async (page, selector, dx = 40) => {
  const r = await rect(page, selector);
  await clearSelection(page);
  await page.mouse.dblclick(r.x + dx, r.y + Math.min(8, r.h / 2));
  await page.waitForTimeout(220);
  return selection(page);
};

/** Types a command into the terminal and returns everything the body shows. */
export const runCommand = async (page, line, settle = 700) => {
  await page.click(".term-body");
  await page.keyboard.type(line);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(settle);
  return page.$eval(".term-body", (el) => el.innerText);
};
