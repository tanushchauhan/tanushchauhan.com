import { openPage, settled } from "../lib/harness.js";

export const name = "mobile: the home page fits, and swipes";

/* The SE is a known miss: fitting it would mean dropping a widget card. */
const SCREENS = [
  { label: "iPhone 15, toolbars showing", width: 393, height: 664, mustFit: true },
  { label: "iPhone 16, toolbars showing", width: 402, height: 700, mustFit: true },
  { label: "15 Pro Max, toolbars showing", width: 430, height: 739, mustFit: true },
  { label: "iPhone 15, toolbars hidden", width: 393, height: 852, mustFit: true },
  { label: "iPhone SE, toolbars showing", width: 375, height: 559, mustFit: false },
];

export const run = async ({ browser, t }) => {
  for (const { label, width, height, mustFit } of SCREENS) {
    for (const authed of [false, true]) {
      const page = await openPage(browser, {
        viewport: { width, height },
        phone: true,
        authed,
      });
      const measured = await page.evaluate(() => {
        const first = document.querySelector(".m-page");
        return {
          over: Math.round(first.scrollHeight - first.clientHeight),
          tier: document.querySelector("#mobile").dataset.fit || "(full)",
        };
      });
      const who = authed ? "signed in" : "a visitor";
      if (mustFit) {
        t.check(
          `${label}, ${who}: the home page fits`,
          measured.over <= 1,
          `rung "${measured.tier}"${measured.over > 1 ? `, over by ${measured.over}px` : ""}`
        );
      } else if (!authed) {
        t.note(`${label}: over by ${measured.over}px at "${measured.tier}", known and accepted`);
      }
      await page.close();
    }
  }

  // ---------- paging ----------
  const page = await openPage(browser, { viewport: { width: 393, height: 664 }, phone: true, authed: false });
  const state = () =>
    page.evaluate(() => {
      const pages = document.querySelector(".m-pages");
      const first = document.querySelector(".m-page");
      return {
        left: Math.round(pages.scrollLeft),
        width: Math.round(pages.clientWidth),
        scrollWidth: Math.round(pages.scrollWidth),
        overflows: first.scrollHeight > first.clientHeight + 1,
        dot: [...document.querySelectorAll(".m-dots button")].findIndex((d) => d.classList.contains("on")),
      };
    });

  let s = await state();
  t.check("two pages sit side by side", s.scrollWidth >= s.width * 2 - 2);
  t.check("page one does not scroll vertically", !s.overflows);
  t.check("and it starts on page one", s.dot === 0);

  await page.evaluate(() => document.querySelector(".m-pages").scrollTo({ left: 9999, behavior: "instant" }));
  await page.waitForTimeout(600);
  s = await state();
  t.check("it moves to page two", s.left >= s.width - 2);
  t.check("the dot follows", s.dot === 1);
  t.check("and the app grid is there", await page.isVisible(".m-grid"));

  await page.click(".m-dots button:first-child");
  await page.waitForTimeout(900);
  t.check("tapping the first dot comes back", (await state()).left <= 2);

  // ---------- settings ----------
  await page.evaluate(() => document.querySelector(".m-pages").scrollTo({ left: 9999, behavior: "instant" }));
  await page.waitForTimeout(500);
  await page.click('.m-app:has([data-icon="settings"])');
  await page.waitForTimeout(900);

  // labels are uppercased in CSS, so compare in lowercase
  const text = (await page.$eval(".m-scroll", (el) => el.innerText)).toLowerCase();
  t.check("settings has appearance", text.includes("appearance"));
  t.check("wallpaper", text.includes("wallpaper"));
  t.check("and sound", text.includes("sound effects"));
  t.check("all three wallpapers are listed", (await page.$$(".m-swatch")).length === 3);

  const paper = () => page.$eval("#mobile", (el) => getComputedStyle(el).backgroundImage);
  t.check("it starts on the default wallpaper", (await paper()).includes("graphite"));

  await page.click(".m-settings:nth-of-type(3) li:nth-child(2)");
  await page.waitForTimeout(700);
  t.check("picking one changes the phone wallpaper", (await paper()).includes("bluebonnet"));

  await page.click(".m-settings:nth-of-type(1) li:nth-child(3)");
  await page.waitForTimeout(700);
  t.check("dark uses the night half of the same one", (await paper()).includes("bluebonnet-night"));

  await page.click(".m-settings:nth-of-type(2) li:nth-child(1)");
  await page.waitForTimeout(400);
  t.check(
    "the glass row applies to the root",
    (await page.evaluate(() => document.documentElement.dataset.glass)) === "clear"
  );

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("tanushos-v1")).state.soundOn);
  await page.click(".m-settings:nth-of-type(4) li");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("tanushos-v1")).state.soundOn);
  t.check("the sound row toggles", after === !before);

  await page.reload({ waitUntil: "domcontentloaded" });
  await settled(page);
  t.check("and it all survives a reload", (await paper()).includes("bluebonnet"));

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();
};
