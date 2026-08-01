import { openPage, seed, win, runCommand, settled } from "../lib/harness.js";
import { fleet } from "../lib/fixtures.js";

export const name = "widgets: dock clearance, refresh, stale services";

/** The clearance the fit ladder is aiming for. Matches DOCK_CLEARANCE. */
const CLEARANCE = 20;

/*
 * Laptop sizes that have actually been a problem, including the ones where the
 * widget block is tallest relative to the screen. The block's height depends on
 * its content, not the viewport, so a media query cannot fit it and only a
 * measured ladder can.
 */
const SCREENS = [
  [1280, 800], [1440, 780], [1440, 900], [1470, 760],
  [1470, 806], [1512, 864], [1512, 950], [1680, 1050],
];

const service = (over) => ({
  slug: "x", name: "X", url: "https://x.example.com", server: "hub",
  ok: true, status: 200, latencyMs: 42, error: null, stale: false,
  since: new Date(Date.now() - 86400000).toISOString(),
  checkedAt: new Date().toISOString(),
  ...over,
});

export const run = async ({ browser, t }) => {
  // ---------- the block clears the dock at every size ----------
  for (const [width, height] of SCREENS) {
    const page = await openPage(browser, { viewport: { width, height } });
    const measured = await page.evaluate(() => {
      const block = document.querySelector("#widgets");
      const dock = document.querySelector("#dock");
      if (!block || !dock) return null;
      return {
        clear: dock.getBoundingClientRect().top - block.getBoundingClientRect().bottom,
        tier: block.dataset.fit || "(full)",
        system: !!document.querySelector(".w-system"),
      };
    });
    t.check(
      `${width}x${height} clears the dock`,
      measured && measured.clear >= CLEARANCE,
      measured ? `${Math.round(measured.clear)}px at "${measured.tier}"` : "no widget block"
    );
    t.check(`${width}x${height} still shows the system card`, measured?.system === true);
    await page.close();
  }

  // ---------- setting a widget refreshes it ----------
  let current = { text: "This website!", updatedAt: "2026-07-26T00:00:00Z" };
  let gets = 0;
  const page = await openPage(browser, { state: seed({ windows: { terminal: win() } }) });
  await page.route("**/api/widgets/building", (r) => {
    if (r.request().method() === "PUT") {
      current = { text: JSON.parse(r.request().postData()).text, updatedAt: new Date().toISOString() };
      return r.fulfill({ json: current });
    }
    gets++;
    return r.fulfill({ json: current });
  });

  const card = () => page.$eval(".w-building", (el) => el.innerText).catch(() => "");
  t.check("the card starts on the stored text", (await card()).includes("This website!"));

  const before = gets;
  const said = await runCommand(page, "building the control center", 1200);
  t.check("the command confirms", said.includes("now building: the control center"));
  t.check(
    "it refetches rather than waiting for the timer",
    gets > before,
    "the poll is fifteen minutes, which reads as a broken card"
  );
  t.check("and the card shows the new text", (await card()).includes("the control center"));

  const stable = await card();
  await page.route("**/api/widgets/building", (r) =>
    r.request().method() === "PUT"
      ? r.fulfill({ status: 400, json: { error: "too long" } })
      : r.fulfill({ json: current })
  );
  await runCommand(page, "building something rejected", 1000);
  t.check("a rejected write leaves the card alone", (await card()) === stable);
  await page.close();

  // ---------- a stale reading is not a verdict ----------
  const withServices = async (services) => {
    const p = await openPage(browser, { state: seed({ windows: { terminal: win() } }) });
    await p.route("**/api/moontower/fleet", (r) => r.fulfill({ json: { ...fleet, services } }));
    await p.reload({ waitUntil: "domcontentloaded" });
    await settled(p);
    return p;
  };

  let svc = await withServices([
    service({ slug: "portfolio", name: "Portfolio", stale: true }),
    service({ slug: "webmail", name: "Webmail", stale: true, ok: false, error: "HTTP 502" }),
  ]);
  let text = await svc.$eval(".w-services", (el) => el.innerText);
  t.check("a stale set does not claim everything is up", !/all \d+ up/.test(text));
  t.check("it says nothing recent is known", text.includes("no recent check"));
  t.check("a stale outage is not shouted about either", !text.includes("1 down"));
  const command = await runCommand(svc, "services");
  t.check("the command marks them too", command.includes("no check"));
  t.check("and prints no stale latency", !/portfolio\s+up/.test(command));
  await svc.close();

  svc = await withServices([
    service({ slug: "portfolio", name: "Portfolio" }),
    service({ slug: "chat", name: "Chat", latencyMs: 118 }),
    service({ slug: "webmail", name: "Webmail", stale: true }),
  ]);
  text = await svc.$eval(".w-services", (el) => el.innerText);
  t.check("the healthy count excludes the stale one", text.includes("all 2 up"));
  t.check("but it is still listed", text.includes("Webmail"));
  await svc.close();

  svc = await withServices([
    service({ slug: "portfolio", name: "Portfolio" }),
    service({
      slug: "webmail", name: "Webmail", ok: false, error: "HTTP 502",
      since: new Date(Date.now() - 23 * 60000).toISOString(),
    }),
  ]);
  text = await svc.$eval(".w-services", (el) => el.innerText);
  t.check("a fresh outage still leads", text.includes("1 down"));
  t.check("and still says how long", /down 23m/.test(text));
  await svc.close();

  // ---------- nothing watched ----------
  const empty = await withServices([]);
  const emptyText = await empty.$eval(".w-services", (el) => el.innerText);
  t.check("an empty card explains itself", emptyText.includes("Nothing watched yet"));
  t.check("and gives the command", emptyText.includes("services add"));
  await empty.close();
};
