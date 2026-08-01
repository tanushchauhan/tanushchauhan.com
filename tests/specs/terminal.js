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
