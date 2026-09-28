import { openPage, seed, win, runCommand, rect } from "../lib/harness.js";

export const name = "analytics: the visit reports";

const text = (page, selector) => page.$eval(selector, (el) => el.innerText);

export const run = async ({ browser, t }) => {
  const page = await openPage(browser, {
    state: seed({ windows: { terminal: win({ zIndex: 1002 }) } }),
  });

  const out = await runCommand(page, "open analytics", 1200);
  t.check("the terminal opens it", out.includes("Opening analytics"));
  t.check("and the window is there", await page.isVisible("#analytics"));

  const overview = await text(page, ".an-body");
  t.check("it opens on the overview", overview.includes("VISITS"));
  t.check("with the visit count", overview.includes("260"), overview.split("\n")[1]);
  t.check("and the people behind them", overview.includes("190 people"));
  t.check("time on site is spelled out", overview.includes("1m 36s"));
  t.check("the funnel is there", overview.includes("opened a project"));

  const bars = await page.$$eval(".an-days span", (els) => els.length);
  t.check("one bar per day in the range", bars === 30, `${bars} bars`);

  await page.click('.an-tabs button:text-is("Traffic")');
  await page.waitForTimeout(400);
  const traffic = await text(page, ".an-body");
  t.check("traffic names the source", traffic.includes("linkedin"));
  t.check("and the campaign on the link", traffic.includes("resume-2026"));
  t.check("and the network the address belongs to", traffic.includes("utexas.edu"));

  await page.click('.an-tabs button:text-is("Visits")');
  await page.waitForTimeout(400);
  const visits = await text(page, ".an-body");
  t.check("a visit says how many times that person came", visits.includes("visit 3"));
  t.check("and what they opened, in order", visits.includes("finder > crave > terminal"));

  // ---------- the click heatmap ----------
  t.check("no heatmap until it is asked for", (await page.$(".an-heatmap")) === null);

  await page.click('.an-tabs button:text-is("Heatmap")');
  await page.waitForTimeout(500);
  t.check("the overlay appears", await page.isVisible(".an-heatmap"));

  const canvas = await rect(page, ".an-heatmap");
  const viewport = page.viewportSize();
  t.check(
    "covering the whole desktop",
    canvas.w === viewport.width && canvas.h === viewport.height,
    `${canvas.w}x${canvas.h}`
  );

  const layering = await page.evaluate(() => ({
    heat: Number(getComputedStyle(document.querySelector(".an-heatmap")).zIndex),
    window: Number(getComputedStyle(document.querySelector("#analytics")).zIndex),
    clicks: getComputedStyle(document.querySelector(".an-heatmap")).pointerEvents,
  }));
  t.check("under the windows, so the report stays readable", layering.heat < layering.window);
  t.check("and it does not swallow clicks", layering.clicks === "none");

  await page.click('.an-tabs button:text-is("Overview")');
  await page.waitForTimeout(400);
  t.check("leaving the tab takes it away", (await page.$(".an-heatmap")) === null);

  // ---------- the range ----------
  await page.click('.an-range button:text-is("7d")');
  await page.waitForTimeout(500);
  t.check("the range switches", await page.isVisible('.an-range button.on:text-is("7d")'));

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join("\n"));
  await page.close();

  // ---------- signed out ----------
  const guest = await openPage(browser, {
    authed: false,
    state: seed({ windows: { terminal: win({ zIndex: 1002 }) } }),
  });
  const refused = await runCommand(guest, "open analytics", 800);
  t.check("a guest is turned away", refused.includes("needs a sign in"));
  t.check("and no window opens", await guest.isHidden("#analytics"));
  await guest.close();
};
