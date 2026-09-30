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
  t.check("and what they opened, in order", visits.includes("finder › crave › terminal"));

  // ---------- the click heatmap ----------
  await page.click('.an-tabs button:text-is("Heatmap")');
  await page.waitForTimeout(600);

  t.check("the small map is drawn", await page.isVisible(".an-map"));
  t.check("with the clicks counted", (await text(page, ".an-body")).includes("120 clicks"));
  t.check("and what was clicked", (await text(page, ".an-body")).includes("MOST CLICKED"));

  const map = await rect(page, ".an-map");
  const viewport = page.viewportSize();
  const ratio = map.w / map.h;
  t.check(
    "shaped like the desktop, so a dot means something",
    Math.abs(ratio - viewport.width / viewport.height) < 0.05,
    ratio.toFixed(2)
  );

  const painted = await page.$eval(".an-map", (el) => {
    const ctx = el.getContext("2d");
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 90 && data[i + 3] > 40) lit += 1;
    return lit;
  });
  t.check("and the heat is actually painted", painted > 200, `${painted} warm pixels`);

  t.check("nothing over the desktop until asked", (await page.$(".an-heatmap")) === null);
  await page.click(".an-toggle");
  await page.waitForTimeout(500);
  t.check("the overlay appears", await page.isVisible(".an-heatmap"));

  const canvas = await rect(page, ".an-heatmap");
  t.check(
    "covering the whole desktop",
    canvas.w === viewport.width && canvas.h === viewport.height,
    `${canvas.w}x${canvas.h}`
  );

  const layering = await page.evaluate(() => ({
    heat: Number(getComputedStyle(document.querySelector(".an-heatmap")).zIndex),
    dock: Number(getComputedStyle(document.querySelector("#dock")).zIndex),
    clicks: getComputedStyle(document.querySelector(".an-heatmap")).pointerEvents,
  }));
  t.check("above the dock, where most clicks land", layering.heat > layering.dock);
  t.check("and it does not swallow clicks", layering.clicks === "none");

  await page.click('.an-tabs button:text-is("Overview")');
  await page.waitForTimeout(400);
  t.check("leaving the tab takes it away", (await page.$(".an-heatmap")) === null);

  // ---------- one visit in full ----------
  await page.click('.an-tabs button:text-is("Visits")');
  await page.waitForTimeout(400);
  await page.click(".an-visits li button");
  await page.waitForTimeout(500);
  const detail = await text(page, ".an-body");
  t.check("a visit opens in full", detail.includes("WHAT HAPPENED"));
  t.check("with the tags the link carried", detail.includes("linkedin · social · resume-2026"));
  t.check("the screen it was read on", detail.includes("1512x950"));
  t.check("and the timezone it was read in", detail.includes("America/Chicago"));
  t.check("the timeline counts from the start", detail.includes("0:00"));
  t.check("and lists what was opened", detail.includes("project_open"));

  await page.click(".an-back");
  await page.waitForTimeout(400);
  t.check("back returns to the list", (await text(page, ".an-body")).includes("visit 3"));

  // ---------- the people behind the visits ----------
  await page.click('.an-tabs button:text-is("People")');
  await page.waitForTimeout(400);
  const people = await text(page, ".an-body");
  t.check("people are listed by visitor number", people.includes("#1204"));
  t.check("with how often they came", people.includes("3 visits"));
  t.check("and what first brought them", people.includes("via linkedin"));

  await page.click('.an-tabs button:text-is("Events")');
  await page.waitForTimeout(400);
  const events = await text(page, ".an-body");
  t.check("every event is counted", events.includes("terminal_command"));
  t.check("with the visits behind it", events.includes("38 visits"));

  // ---------- the sidebar ----------
  const layout = await page.evaluate(() => {
    const bar = document.querySelector(".an-tabs").getBoundingClientRect();
    const [reports, visitors] = [...document.querySelectorAll(".an-tabs h3")].map(
      (h) => h.getBoundingClientRect().left
    );
    const live = document.querySelector(".an-doing").getBoundingClientRect();
    return { reports, visitors, bar, live };
  });
  t.check(
    "the sidebar groups line up",
    layout.reports === layout.visitors,
    `${layout.reports} vs ${layout.visitors}`
  );
  t.check(
    "and a long live line stays inside it",
    layout.live.left >= layout.bar.left && layout.live.right <= layout.bar.right,
    `${Math.round(layout.live.left)}-${Math.round(layout.live.right)} in ${Math.round(layout.bar.left)}-${Math.round(layout.bar.right)}`
  );

  // ---------- my own visits ----------
  const asked = [];
  page.on("request", (req) => req.url().includes("/api/tel/") && asked.push(req.url()));

  await page.click('.an-tabs button:text-is("Overview")');
  await page.waitForTimeout(400);
  t.check(
    "my visits are left out and counted",
    (await text(page, ".an-body")).includes("12 of yours hidden")
  );
  t.check("reports are asked without them", asked.length > 0 && asked.every((url) => !url.includes("me=1")));

  asked.length = 0;
  await page.click(".an-me");
  await page.waitForTimeout(500);
  t.check("the switch turns on", (await page.getAttribute(".an-me", "aria-checked")) === "true");
  t.check(
    "and every report is asked again with them",
    asked.some((url) => url.includes("/overview")) && asked.every((url) => url.includes("me=1")),
    asked.join("\n")
  );
  t.check("the count says they are in", (await text(page, ".an-body")).includes("12 of them yours"));

  await page.click('.an-tabs button:text-is("People")');
  await page.waitForTimeout(400);
  t.check("and it holds across tabs", asked.some((url) => url.includes("/people?limit=60&me=1")));

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
  t.check(
    "and the desktop has no Applications folder",
    await guest.isHidden('#home li[data-id="applications"]')
  );
  await guest.close();

  // ---------- the Applications folder ----------
  const desktop = await openPage(browser);
  t.check(
    "signed in, the folder is on the desktop",
    await desktop.isVisible('#home li[data-id="applications"]')
  );

  await desktop.click('#home li[data-id="applications"]');
  await desktop.waitForTimeout(900);

  const folder = await desktop.$eval('[id^="finder"] ul.content', (el) => el.innerText);
  t.check("it holds the apps", folder.includes("Analytics") && folder.includes("Guestbook"));

  const sidebar = await desktop.$eval('[id^="finder"] .sidebar', (el) => el.innerText);
  t.check("but it stays out of the sidebar", !sidebar.includes("Applications"));

  await desktop.dblclick('[id^="finder"] ul.content li:has-text("Analytics")');
  await desktop.waitForTimeout(900);
  t.check("and Analytics opens from it", await desktop.isVisible("#analytics"));
  t.check("no page errors opening it", desktop.pageErrors.length === 0, desktop.pageErrors.join("\n"));
  await desktop.close();
};
