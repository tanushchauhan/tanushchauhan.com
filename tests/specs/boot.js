import { openPage } from "../lib/harness.js";

export const name = "boot: the screen anyone sees first";

const gone = (page, timeout) =>
  page
    .waitForSelector("#boot", { state: "detached", timeout })
    .then(() => true)
    .catch(() => false);

export const run = async ({ browser, t }) => {
  const page = await openPage(browser, { settle: false });
  t.check("it shows on the first load of a session", await page.isVisible("#boot"));

  const started = Date.now();
  t.check("and gets out of the way on its own", await gone(page, 4000));
  const took = Date.now() - started;
  t.check("within a second and a half", took < 1500, `${took}ms`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  t.check("it does not play again in the same tab", (await page.$("#boot")) === null);
  await page.close();

  // ---------- skipping ----------
  const skipped = await openPage(browser, { settle: false });
  await skipped.waitForSelector("#boot");
  const pressed = Date.now();
  await skipped.keyboard.press("Space");
  t.check("a key takes you straight to the desktop", await gone(skipped, 2000));
  t.check("without waiting out the animation", Date.now() - pressed < 700, `${Date.now() - pressed}ms`);
  t.check("and the desktop is there", await skipped.isVisible("#dock"));
  await skipped.close();

  const clicked = await openPage(browser, { settle: false });
  await clicked.waitForSelector("#boot");
  await clicked.mouse.click(640, 400);
  t.check("so does a click", await gone(clicked, 2000));
  await clicked.close();

  // ---------- reduced motion ----------
  const still = await openPage(browser, { settle: false, reducedMotion: "reduce" });
  await still.waitForTimeout(500);
  t.check("it is skipped entirely under reduced motion", (await still.$("#boot")) === null);
  t.check("and the desktop is shown at once", await still.isVisible("#dock"));
  await still.close();
};
