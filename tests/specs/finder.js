import { openPage, seed, win } from "../lib/harness.js";

export const name = "finder: selection, quick look, back and forward";

/*
 * A click selects and a double-click opens, as in Finder, and Space shows the
 * selection in Quick Look. The status bar is what tells a visitor that, so it
 * is checked along with the behaviour.
 */
export const run = async ({ browser, t }) => {
  const page = await openPage(browser, {
    state: seed({ windows: { finder: win({ data: { ref: "about" } }) } }),
    authed: false,
  });
  const title = () => page.$eval("#finder #window-header h2", (el) => el.innerText);
  const preview = () => page.$eval("#quick-look h2", (el) => el.innerText).catch(() => null);
  const status = () => page.$eval("#finder .finder-status", (el) => el.innerText);

  t.check("the status bar counts the items", /\d+ items/.test(await status()));

  await page.click('#finder ul.content li:has-text("about-me.txt")');
  await page.waitForTimeout(200);
  t.check("a click selects", await page.isVisible("#finder ul.content li.selected"));
  t.check("and does not open", !(await page.isVisible("#txtFile")));
  t.check("the status bar says how to open it", (await status()).includes("double-click to open"));

  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  t.check("space opens quick look on it", (await preview()) === "about-me.txt");
  t.check("with the file's text in it", (await page.$eval("#quick-look", (el) => el.innerText)).includes("CS Honors"));

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  t.check("an arrow moves the preview along", (await preview()) === "fun-facts.txt");

  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  t.check("space again closes it", (await preview()) === null);

  await page.keyboard.press(" ");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  t.check("and so does escape", (await preview()) === null);

  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  await page.click("#quick-look .ql-open");
  await page.waitForTimeout(400);
  t.check("its open button opens the file", await page.isVisible("#txtFile"));
  t.check("and puts the preview away", (await preview()) === null);

  // ---------- double-click, and back and forward ----------
  await page.click('#finder .sidebar li:has-text("Publications")');
  await page.waitForTimeout(200);
  await page.dblclick('#finder ul.content li:has-text("MemeQA")');
  await page.waitForTimeout(300);
  t.check("a double-click opens a folder", (await title()).startsWith("MemeQA"));
  t.check("each paper has its own folder", (await page.$$("#finder ul.content li")).length === 3);

  await page.click('#finder .finder-nav button[aria-label="Back"]');
  await page.waitForTimeout(200);
  t.check("back returns to the list", (await title()) === "Publications");
  await page.click('#finder .finder-nav button[aria-label="Forward"]');
  await page.waitForTimeout(200);
  t.check("and forward goes in again", (await title()).startsWith("MemeQA"));

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();
};
