import {
  openPage, seed, win, rect, near, drag, corner, storedState, settled,
} from "../lib/harness.js";

export const name = "windows: dragging, resizing, maximizing";

/**
 * Windows resize from any edge or corner. The invariants worth protecting:
 * a corner drag moves only the corner you grabbed, the minimum holds, the
 * window cannot be dragged off the desktop, the size persists, and the body
 * takes the space rather than the chrome.
 */
export const run = async ({ browser, t }) => {
  const page = await openPage(browser, {
    state: seed({ windows: { terminal: win(), about: win({ zIndex: 1000 }) } }),
  });

  t.check("the terminal opens", await page.isVisible("#terminal"));

  // ---------- growing ----------
  let before = await rect(page, "#terminal");
  await drag(page, corner(before, "se"), 140, 90);
  let after = await rect(page, "#terminal");
  t.check(
    "the south east corner grows both dimensions",
    near(after.w, before.w + 140) && near(after.h, before.h + 90),
    `${Math.round(before.w)}x${Math.round(before.h)} -> ${Math.round(after.w)}x${Math.round(after.h)}`
  );
  t.check(
    "and leaves the top left where it was",
    near(after.x, before.x) && near(after.y, before.y)
  );

  const bodyHeight = await page.$eval(".term-body", (el) => el.getBoundingClientRect().height);
  t.check("the body takes the new height, not the chrome", bodyHeight > 300, `${Math.round(bodyHeight)}px`);

  // ---------- the opposite corner is pinned ----------
  before = await rect(page, "#terminal");
  await drag(page, corner(before, "nw"), -100, -60);
  after = await rect(page, "#terminal");
  t.check(
    "the north west corner pins the bottom right",
    near(after.right, before.right) && near(after.bottom, before.bottom),
    `right ${Math.round(before.right)}->${Math.round(after.right)}`
  );
  t.check(
    "and grows the window instead",
    near(after.w, before.w + 100) && near(after.h, before.h + 60)
  );

  // ---------- the minimum ----------
  before = await rect(page, "#terminal");
  await drag(page, corner(before, "se"), -2000, -2000);
  after = await rect(page, "#terminal");
  t.check("width stops at the minimum", near(after.w, 420), `${Math.round(after.w)}`);
  t.check("height stops at the minimum", near(after.h, 240), `${Math.round(after.h)}`);
  t.check(
    "and the window does not slide once it stops shrinking",
    near(after.x, before.x) && near(after.y, before.y),
    "the shift has to come from the clamped size, not the pointer"
  );

  // ---------- the desktop is the limit ----------
  const desktop = await rect(page, "main");
  before = await rect(page, "#terminal");
  await drag(page, corner(before, "se"), 3000, 3000);
  after = await rect(page, "#terminal");
  t.check(
    "cannot be dragged wider than the desktop",
    after.right <= desktop.right + 2,
    `right ${Math.round(after.right)} vs ${Math.round(desktop.right)}`
  );
  t.check(
    "cannot be dragged taller than the desktop",
    after.bottom <= desktop.bottom + 2,
    `bottom ${Math.round(after.bottom)} vs ${Math.round(desktop.bottom)}`
  );

  // ---------- persistence ----------
  before = await rect(page, "#terminal");
  await drag(page, corner(before, "se"), -300, -200);
  const sized = await rect(page, "#terminal");

  const stored = (await storedState(page)).windows.terminal.size;
  t.check(
    "the size is written to the store",
    stored && near(stored.w, sized.w) && near(stored.h, sized.h),
    JSON.stringify(stored)
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await settled(page);
  const restored = await rect(page, "#terminal");
  t.check(
    "and survives a reload",
    near(restored.w, sized.w) && near(restored.h, sized.h),
    `${Math.round(sized.w)}x${Math.round(sized.h)} -> ${Math.round(restored.w)}x${Math.round(restored.h)}`
  );

  // ---------- dragging still works ----------
  const beforeMove = await rect(page, "#terminal");
  const header = await rect(page, "#terminal #window-header");
  await drag(page, { x: header.x + header.w / 2, y: header.y + header.h / 2 }, 60, 40);
  const moved = await rect(page, "#terminal");
  t.check(
    "the window still drags by its header",
    near(moved.x, beforeMove.x + 60) && near(moved.y, beforeMove.y + 40),
    `${Math.round(beforeMove.x)},${Math.round(beforeMove.y)} -> ${Math.round(moved.x)},${Math.round(moved.y)}`
  );
  t.check("and dragging does not resize it", near(moved.w, beforeMove.w) && near(moved.h, beforeMove.h));

  // ---------- maximize ----------
  t.check("all eight handles are present", (await page.$$("#terminal .rh")).length === 8);
  await page.click("#terminal #window-controls .maximize");
  await page.waitForTimeout(500);
  t.check("maximizing takes the handles away", (await page.$$("#terminal .rh")).length === 0);
  t.check("and fills the desktop", (await rect(page, "#terminal")).w > 1400);

  await page.click("#terminal #window-controls .maximize");
  await page.waitForTimeout(500);
  t.check("restoring brings them back", (await page.$$("#terminal .rh")).length === 8);
  const unmaximized = await rect(page, "#terminal");
  t.check(
    "and returns to the size it had",
    near(unmaximized.w, sized.w) && near(unmaximized.h, sized.h),
    `${Math.round(unmaximized.w)}x${Math.round(unmaximized.h)}`
  );

  // ---------- the panels that do not resize ----------
  t.check("About This Mac has no handles", (await page.$$("#about .rh")).length === 0);

  /* A window that was empty at mount. The text and image viewers render nothing
     until they are handed a file, so they had no header for Draggable to take
     as its trigger and it fell back to the whole window: a press on a resize
     handle started a drag as well, and the grabbed edge moved at twice the
     pointer while the opposite one came with it. */
  await page.click("#terminal #window-controls .close"); // it covers the panel by now
  await page.waitForTimeout(400);
  await page.click("#about .about-body button");
  await page.waitForTimeout(900);
  t.check("a text file opened after boot", await page.isVisible("#txtFile"));

  before = await rect(page, "#txtFile");
  await drag(page, { x: before.right - 2, y: before.y + before.h / 2 }, 100, 0);
  after = await rect(page, "#txtFile");
  t.check(
    "resizing one of those does not drag it as well",
    near(after.x, before.x) && near(after.w, before.w + 100),
    `x ${Math.round(before.x)}->${Math.round(after.x)}, w ${Math.round(before.w)}->${Math.round(after.w)}`
  );

  // ---------- the grab band ----------
  const edge = await rect(page, "#txtFile");
  const grabbable = async (dx) =>
    page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.classList?.contains("rh"),
      [edge.right + dx, edge.y + edge.h / 2]
    );
  t.check("the grab band reaches outside the frame", await grabbable(-4));
  t.check("and inside it", await grabbable(4));

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();
};
