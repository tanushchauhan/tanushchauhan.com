import { openPage, seed, win, runCommand } from "../lib/harness.js";

export const name = "guestbook: moderation from the terminal";

const entries = [
  { id: 7, name: "spammer", message: "buy   cheap   things now", createdAt: "2026-07-30T10:00:00Z", isHidden: false, source: "abcdef01" },
  { id: 6, name: "spammer", message: "and more of them", createdAt: "2026-07-30T09:59:00Z", isHidden: true, source: "abcdef01" },
  { id: 5, name: "a friend", message: "nice site, the terminal is a good touch", createdAt: "2026-07-29T12:00:00Z", isHidden: false, source: "99887766" },
];

/**
 * is_hidden had been in the schema since the table existed with nothing able to
 * set it, so taking an entry down meant a psql session against production.
 * These are the controls that replaced that.
 */
export const run = async ({ browser, t }) => {
  const sent = [];
  const page = await openPage(browser, { state: seed({ windows: { terminal: win() } }) });

  await page.route("**/api/guestbook/all", (r) => r.fulfill({ json: { entries } }));
  await page.route("**/api/guestbook/*", (r) => {
    const request = r.request();
    if (request.method() === "GET") return r.fallback();
    sent.push({ method: request.method(), url: request.url(), body: request.postData() });
    const id = Number(request.url().split("/").pop());
    if (id === 999) return r.fulfill({ status: 404, json: { error: `no entry ${id}` } });
    return r.fulfill({
      json:
        request.method() === "DELETE"
          ? { removed: id }
          : { id, isHidden: JSON.parse(request.postData()).hidden },
    });
  });

  let out = await runCommand(page, "guestbook");
  t.check("it lists every entry, hidden included", out.includes("3 entries, 1 hidden"));
  t.check("hidden rows are marked", /-\s+6\s/.test(out));
  t.check(
    "the source fingerprint groups a spam run",
    out.includes("abcdef01"),
    "eight characters of the salted ip hash, so one source reads as one source"
  );
  t.check("whitespace in a message is collapsed", out.includes("buy cheap things now"));
  t.check("and it says how to act on a row", out.includes("guestbook hide <id...>"));

  out = await runCommand(page, "guestbook hide 7");
  t.check("hiding one reports it", out.includes("7 is hidden."));
  t.check(
    "and sends a PATCH with hidden true",
    sent.at(-1)?.method === "PATCH" && JSON.parse(sent.at(-1).body).hidden === true
  );

  sent.length = 0;
  out = await runCommand(page, "guestbook hide 7 6");
  t.check("it takes several ids at once", sent.length === 2 && out.includes("7, 6 are hidden."));

  out = await runCommand(page, "guestbook show 6");
  t.check("showing reports it", out.includes("6 is visible again."));
  t.check("and sends hidden false", JSON.parse(sent.at(-1).body).hidden === false);

  out = await runCommand(page, "guestbook rm 5");
  t.check("deleting reports it", out.includes("5 is deleted."));
  t.check("and sends a DELETE with no body", sent.at(-1).method === "DELETE" && !sent.at(-1).body);

  out = await runCommand(page, "guestbook hide 999");
  t.check("a missing id is reported rather than swallowed", out.includes("could not touch 999"));

  out = await runCommand(page, "guestbook hide");
  t.check("no id prints the usage", out.includes("usage: guestbook hide <id> [id...]"));
  await page.close();

  // ---------- signed out ----------
  let reached = 0;
  const anon = await openPage(browser, {
    authed: false,
    state: seed({ windows: { terminal: win() } }),
  });
  await anon.route("**/api/guestbook/**", (r) => {
    reached++;
    r.fulfill({ json: { entries } });
  });

  t.check("signed out, it refuses", (await runCommand(anon, "guestbook")).includes("not signed in"));
  t.check("deleting refuses too", (await runCommand(anon, "guestbook rm 5")).includes("not signed in"));
  t.check("and nothing is ever sent", reached === 0, `${reached} requests`);
  await anon.close();
};
