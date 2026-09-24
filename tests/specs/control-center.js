import { openPage, seed, storedState, settled } from "../lib/harness.js";

export const name = "control center: appearance, wallpaper, sound";

const wallpaperOf = (page) =>
  page.$eval("#root", (el) => getComputedStyle(el).backgroundImage);
const isDark = (page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

export const run = async ({ browser, t }) => {
  const page = await openPage(browser, { state: seed({ windows: {} }) });

  t.check("the menu bar has the button", await page.isVisible("#control-center-button"));
  t.check("the panel starts closed", !(await page.isVisible(".control-center")));

  await page.click("#control-center-button");
  await page.waitForTimeout(400);
  t.check("clicking opens it", await page.isVisible(".control-center"));

  // ---------- appearance ----------
  await page.click(".cc-segmented button:nth-child(3)"); // Dark
  await page.waitForTimeout(400);
  t.check("dark applies", await isDark(page));
  t.check(
    "and the segment shows it",
    (await page.$eval(".cc-segmented button.on", (el) => el.innerText)).includes("Dark")
  );
  t.check(
    "the wallpaper follows the theme",
    (await wallpaperOf(page)).includes("austin-night"),
    "every wallpaper is a light/dark pair"
  );

  await page.click(".cc-segmented button:nth-child(2)"); // Light
  await page.waitForTimeout(400);
  t.check("light applies", !(await isDark(page)));
  t.check("and swaps back to the day one", (await wallpaperOf(page)).includes("austin.svg"));

  // ---------- glass ----------
  const glassOf = () => page.evaluate(() => document.documentElement.dataset.glass);
  t.check("three glass levels are offered", (await page.$$(".cc-glass button")).length === 3);
  t.check("tinted is the default", (await glassOf()) === "tinted");
  await page.click(".cc-glass button:nth-child(1)"); // Clear
  await page.waitForTimeout(300);
  t.check("clear applies to the root", (await glassOf()) === "clear");
  t.check(
    "and the chrome gets thinner",
    parseFloat(await page.$eval(".dock-container", (el) => getComputedStyle(el).getPropertyValue("--glass-alpha"))) < 0.3
  );
  await page.click(".cc-glass button:nth-child(2)"); // Regular
  await page.waitForTimeout(300);
  t.check("regular applies", (await glassOf()) === "regular");
  await page.click(".cc-glass button:nth-child(3)"); // Tinted
  await page.waitForTimeout(300);
  t.check("and tinted again", (await glassOf()) === "tinted");
  t.check(
    "and the menu bar grows a band",
    (await page.$eval("nav", (el) => getComputedStyle(el).backdropFilter)) !== "none"
  );

  // ---------- wallpaper ----------
  t.check("every wallpaper is offered", (await page.$$(".cc-paper")).length === 3);
  t.check("each swatch shows both halves", (await page.$$(".cc-paper:first-child .swatch img")).length === 2);

  await page.click(".cc-paper:nth-child(2)");
  await page.waitForTimeout(500);
  t.check("picking one changes the desktop", (await wallpaperOf(page)).includes("bluebonnet.svg"));
  t.check(
    "and it is marked as chosen",
    (await page.$eval(".cc-paper.on .name", (el) => el.innerText)) === "Bluebonnet"
  );

  await page.click(".cc-segmented button:nth-child(3)");
  await page.waitForTimeout(400);
  t.check(
    "the new wallpaper has its own night version",
    (await wallpaperOf(page)).includes("bluebonnet-night")
  );

  await page.click(".cc-paper:nth-child(3)");
  await page.waitForTimeout(500);
  t.check("a third choice works too", (await wallpaperOf(page)).includes("graphite-night"));

  // ---------- sound ----------
  const soundBefore = (await storedState(page)).soundOn;
  await page.click(".cc-row");
  await page.waitForTimeout(300);
  t.check("the sound switch flips", (await storedState(page)).soundOn === !soundBefore);
  t.check(
    "and the switch shows it",
    (await page.$$(".cc-switch.on")).length === (soundBefore ? 0 : 1)
  );

  // ---------- closing ----------
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  t.check("escape closes it", !(await page.isVisible(".control-center")));

  await page.click("#control-center-button");
  await page.waitForTimeout(300);
  await page.mouse.click(1100, 820); // bare wallpaper
  await page.waitForTimeout(300);
  t.check("clicking the desktop closes it", !(await page.isVisible(".control-center")));

  await page.click("#control-center-button");
  await page.waitForTimeout(300);
  await page.mouse.click(700, 660); // a widget
  await page.waitForTimeout(300);
  t.check(
    "clicking a widget closes it too",
    !(await page.isVisible(".control-center")),
    "widgets are draggables and preventDefault on pointerdown, which suppresses mousedown entirely"
  );

  await page.click("#control-center-button");
  await page.waitForTimeout(300);
  await page.click("#control-center-button");
  await page.waitForTimeout(300);
  t.check("the button toggles rather than reopening", !(await page.isVisible(".control-center")));

  // ---------- the desktop menu opens it ----------
  await page.mouse.click(1100, 820, { button: "right" });
  await page.waitForTimeout(400);
  const items = await page.$$eval(".desktop-menu button", (els) => els.map((e) => e.innerText.trim()));
  t.check("Change Wallpaper is in the right-click menu", items.some((i) => i.includes("Change Wallpaper")));

  const themeBefore = await isDark(page);
  const buttons = await page.$$(".desktop-menu button");
  await buttons[items.findIndex((i) => i.includes("Change Wallpaper"))].click();
  await page.waitForTimeout(500);
  t.check("and opens the picker", await page.isVisible(".control-center"));
  t.check("and leaves the theme alone", (await isDark(page)) === themeBefore);

  await page.mouse.click(1100, 820);
  await page.waitForTimeout(300);
  t.check("the desktop menu closes on a widget click too", !(await page.isVisible(".desktop-menu")));

  // ---------- new folder, and clean up ----------
  const folderAt = (sel) =>
    page.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, left: Math.round(r.left) };
    });
  await page.mouse.click(960, 640, { button: "right" });
  await page.waitForTimeout(300);
  await page.click('.desktop-menu button:has-text("New Folder")');
  await page.waitForTimeout(300);
  const made = await folderAt("#home .folder:not([data-project])");
  t.check(
    "a new folder lands where you right-clicked",
    Math.abs(made.x - 960) < 30 && Math.abs(made.y - 640) < 50,
    `centre at ${Math.round(made.x)},${Math.round(made.y)}`
  );

  await page.mouse.click(1100, 820, { button: "right" });
  await page.waitForTimeout(300);
  await page.click('.desktop-menu button:has-text("Clean Up")');
  await page.waitForTimeout(700);
  const columns = await page.$$eval("#home .folder[data-project]", (els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left))
  );
  const tidied = await folderAt("#home .folder:not([data-project])");
  t.check(
    "clean up puts it on the grid with the project folders",
    columns.includes(tidied.left),
    `at ${tidied.left}, columns ${[...new Set(columns)].join(", ")}`
  );

  // ---------- persistence ----------
  const before = await storedState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settled(page);
  const after = await storedState(page);
  t.check("the wallpaper is remembered", after.wallpaper === "graphite", after.wallpaper);
  t.check("the theme is remembered", after.theme === before.theme);
  t.check("the glass level is remembered", after.glass === "tinted", after.glass);
  t.check("the panel does not reopen itself", !(await page.isVisible(".control-center")));
  t.check("and the desktop comes back with the chosen wallpaper", (await wallpaperOf(page)).includes("graphite"));

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();
};
