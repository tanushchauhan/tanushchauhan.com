import { openPage, rect } from "../lib/harness.js";

export const name = "dock: labels";

const label = (page, app) =>
  page.$eval(`.dock-slot[data-label="${app}"]`, (el) => getComputedStyle(el, "::after").opacity);

export const run = async ({ browser, t }) => {
  const page = await openPage(browser);

  for (const app of ["Projects", "Gallery", "Contact"]) {
    const slot = await rect(page, `.dock-slot[data-label="${app}"]`);
    await page.mouse.move(slot.x + slot.w / 2, slot.y + slot.h / 2, { steps: 4 });
    await page.waitForTimeout(500);
    t.check(`${app}: pointing at it shows its name`, (await label(page, app)) === "1");

    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.mouse.move(slot.x + slot.w / 2, slot.y - 400, { steps: 6 });
    await page.waitForTimeout(500);
    t.check(`${app}: and the name goes once the pointer leaves after a click`, (await label(page, app)) === "0");
  }

  await page.focus('.dock-slot[data-label="Projects"] button');
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  const focused = await page.evaluate(() => document.activeElement?.closest(".dock-slot")?.dataset.label);
  t.check(
    "tabbing along the dock still shows the name",
    focused === "Highlights" && (await label(page, focused)) === "1",
    focused
  );

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join("\n"));
  await page.close();
};
