import {
  openPage, seed, win, PHONE, rect, drag, selection, clearSelection, runCommand,
} from "../lib/harness.js";

export const name = "terminal: copying output, and a phone keyboard";

export const run = async ({ browser, t }) => {
  const page = await openPage(browser, { state: seed({ windows: { terminal: win() } }) });

  // ---------- output is there to be copied ----------
  await runCommand(page, "neofetch", 800);

  /* The body scrolls to the bottom after each command, so the first line is off
     screen and a drag at its coordinates lands on the desktop. Pick a line that
     is actually inside the visible body. */
  const line = await page.evaluate(() => {
    const body = document.querySelector(".term-body").getBoundingClientRect();
    const found = [...document.querySelectorAll(".term-body .out")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.top > body.top + 4 && r.bottom < body.bottom - 4 && r.width > 80)
      .pop();
    return found ? { x: found.x, y: found.y + found.height / 2, w: found.width } : null;
  });
  t.check("found a visible line of output", !!line);

  await drag(page, { x: line.x + 3, y: line.y }, Math.min(line.w - 6, 260), 0, 20);
  const selected = await selection(page);
  t.check("output can be selected", selected.length > 3, JSON.stringify(selected.slice(0, 40)));

  await page.waitForTimeout(400);
  t.check(
    "and survives the click handler that refocuses the prompt",
    (await selection(page)).length > 3
  );

  // ---------- a plain click still focuses ----------
  await clearSelection(page);
  const body = await rect(page, ".term-body");
  await page.mouse.click(body.x + body.w - 30, body.y + body.h - 20);
  await page.waitForTimeout(300);
  t.check(
    "a plain click focuses the prompt",
    (await page.evaluate(() => document.activeElement?.className)) === "term-input"
  );

  const after = await runCommand(page, "echo still works");
  t.check("and typing still works", after.includes("still works"));

  // ---------- capitalised commands ----------
  t.check(
    "a capitalised builtin runs",
    !(await runCommand(page, "Ls")).includes("command not found")
  );
  t.check(
    "a capitalised sudo reaches the sign in rather than an error",
    !(await runCommand(page, "Sudo")).includes("command not found: Sudo"),
    "the first word of a line is the one a phone keyboard capitalises"
  );
  const typo = await runCommand(page, "Nonsense");
  t.check("a real typo still reports what was typed", typo.includes("command not found: Nonsense"));
  t.check(
    "arguments keep their capitals",
    (await runCommand(page, "echo Keeps My Case")).includes("Keeps My Case")
  );

  // ---------- the games, over output that has scrolled ----------
  /* Everything above has pushed the prompt well down, which is the state the
     games used to break in: the canvas was placed against the top of the
     scrolled content and drew above the visible part of the window. */
  const overlay = () =>
    page.evaluate(() => {
      const body = document.querySelector("#terminal .term-body");
      const c = document.querySelector("#terminal .term-overlay");
      if (!c) return null;
      const b = body.getBoundingClientRect();
      const r = c.getBoundingClientRect();
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] > 60 || px[i + 1] > 60) lit++;
      return { scrolled: body.scrollTop, top: r.top - b.top, h: r.height, bodyH: b.height, lit };
    });

  await runCommand(page, "matrix", 900);
  const rain = await overlay();
  t.check("matrix opens over a scrolled terminal", rain?.scrolled > 0, JSON.stringify(rain));
  t.check(
    "and covers what is on screen",
    rain && Math.abs(rain.top) < 2 && Math.abs(rain.h - rain.bodyH) < 2,
    JSON.stringify(rain)
  );
  t.check("and actually rains", rain?.lit > 200);
  await page.keyboard.press("x");
  await page.waitForTimeout(400);
  t.check("any key ends it", !(await overlay()));

  await runCommand(page, "snake", 600);
  const game = await overlay();
  t.check(
    "snake covers what is on screen",
    game && Math.abs(game.top) < 2 && Math.abs(game.h - game.bodyH) < 2,
    JSON.stringify(game)
  );
  t.check("and draws a board", game?.lit > 100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  t.check("escape quits", (await page.$eval(".term-body", (el) => el.innerText)).includes("snake: quit"));
  t.check(
    "and hands the prompt back",
    (await runCommand(page, "echo back again")).includes("back again")
  );

  t.check(
    "visitor says which number you are",
    (await runCommand(page, "visitor")).includes("visitor number 1,204")
  );

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();

  // ---------- the phone keyboard ----------
  const phone = await openPage(browser, { viewport: PHONE, phone: true });
  await phone.click('.m-dock button:nth-child(2)'); // terminal
  await phone.waitForTimeout(1200);
  t.check("the terminal opens on the phone", await phone.isVisible(".term-input"));

  const attrs = await phone.$eval(".term-input", (el) => ({
    capitalize: el.getAttribute("autocapitalize"),
    correct: el.getAttribute("autocorrect"),
    spell: el.getAttribute("spellcheck"),
    editable: el.isContentEditable,
  }));
  t.check("it asks iOS not to capitalise", attrs.capitalize === "none", JSON.stringify(attrs.capitalize));
  t.check("or autocorrect", attrs.correct === "off");
  t.check("spellcheck stays off", attrs.spell === "false");
  t.check("and it is still editable", attrs.editable);
  await phone.close();
};
