import {
  openPage, seed, win, rect, drag, selection, isSelectable, selectWord,
} from "../lib/harness.js";

export const name = "selection: window text yes, desktop chrome no";

/**
 * The body sets select-none for the whole desktop, which is right for the dock
 * and the folder labels and wrong for everything inside a window. The cost of
 * getting this wrong is quiet: a visitor who cannot copy the email address just
 * leaves, and never tells anybody.
 */
export const run = async ({ browser, t }) => {
  // ---------- the case with a cost ----------
  let page = await openPage(browser, { state: seed({ windows: { contact: win() } }) });
  t.check("the contact body is selectable", await isSelectable(page, "#contact .body"));

  const email = await rect(page, "#contact .email");
  await drag(page, { x: email.x + 3, y: email.y + email.h / 2 }, Math.min(email.w - 6, 300), 0, 18);
  const dragged = await selection(page);
  t.check("the email address can be dragged over", /@/.test(dragged), JSON.stringify(dragged));
  await page.close();

  // ---------- the rest of the window content ----------
  page = await openPage(browser, { state: seed({ windows: { guestbook: win() } }) });
  t.check("the guestbook list is selectable", await isSelectable(page, ".gb-list"));
  const quoted = await selectWord(page, ".gb-list p:last-of-type");
  t.check("a word in an entry selects", quoted.length > 2, JSON.stringify(quoted));
  await page.close();

  page = await openPage(browser, {
    state: seed({
      windows: {
        txtFile: win({
          data: {
            name: "about-me.txt",
            subtitle: "a subtitle",
            description: ["A paragraph somebody might reasonably want to copy out of this window."],
          },
        }),
      },
    }),
  });
  t.check("a text file is selectable", await isSelectable(page, "#txtFile .txt-body"));
  const prose = await selectWord(page, "#txtFile .txt-body p:last-of-type");
  t.check("a word of prose selects", prose.length > 2, JSON.stringify(prose));
  await page.close();

  page = await openPage(browser, { state: seed({ windows: { about: win() } }) });
  t.check("About This Mac is selectable", await isSelectable(page, "#about .about-body"));
  await page.close();

  // ---------- chrome ----------
  page = await openPage(browser, { state: seed({ windows: { contact: win() } }) });
  for (const [label, selector] of [
    ["the desktop hero", "#welcome h1"],
    ["the dock", ".dock-container"],
    ["the menu bar", "nav"],
    ["a window title bar", "#contact #window-header"],
  ]) {
    const result = await isSelectable(page, selector)
      .then((s) => !s)
      .catch(() => "missing");
    t.check(`${label} stays unselectable`, result === true, result === "missing" ? "selector not found" : "");
  }

  const title = await rect(page, "#contact #window-header h2");
  await drag(page, { x: title.x + 3, y: title.y + title.h / 2 }, 120, 0);
  t.check("dragging a title bar selects nothing", (await selection(page)) === "");

  const beforeMove = await rect(page, "#contact");
  const header = await rect(page, "#contact #window-header");
  await drag(page, { x: header.x + header.w / 2, y: header.y + header.h / 2 }, 70, 30, 12);
  const moved = await rect(page, "#contact");
  t.check(
    "and still moves the window",
    Math.abs(moved.x - beforeMove.x - 70) < 3,
    `${Math.round(beforeMove.x)} -> ${Math.round(moved.x)}`
  );
  await page.close();

  // ---------- Finder items are icons, not prose ----------
  page = await openPage(browser, { state: seed({ windows: { finder: win() } }) });
  const finderItems = await isSelectable(page, "#finder .finder-body .content li")
    .then((s) => !s)
    .catch(() => "missing");
  t.check("Finder items stay unselectable", finderItems === true);

  const grid = await rect(page, "#finder .finder-body .content");
  await drag(page, { x: grid.x + 3, y: grid.y + 30 }, 280, 0, 18);
  t.check("dragging across the grid highlights nothing", (await selection(page)) === "");
  await page.close();
};
