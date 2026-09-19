import { openPage, seed, win, storedState, settled } from "../lib/harness.js";

export const name = "persistence: windows restore by reference, not by copy";

/** Window data is stored as a reference, so a returning visitor sees the current text. */
export const run = async ({ browser, t }) => {
  // ---------- a v2 save ----------
  const v2 = JSON.stringify({
    version: 2,
    state: JSON.parse(
      seed({
        windows: {
          finder: win({
            data: {
              id: "grademate",
              name: "GradeMate",
              kind: "folder",
              children: [
                {
                  id: "grademate-gh",
                  name: "stale-link.url",
                  icon: "/icons/file.svg",
                  kind: "file",
                  fileType: "url",
                  href: "https://example.com",
                  position: "top-4 left-4",
                },
              ],
            },
          }),
          txtFile: win({
            zIndex: 1002,
            data: { name: "about-me.txt", subtitle: "stale subtitle", description: ["stale body"] },
          }),
        },
      })
    ).state,
  });

  let page = await openPage(browser, { state: v2 });

  const folder = await page.$eval("#finder .finder-body .content", (el) => el.innerText);
  t.check(
    "a folder saved before the copy changed shows what this build says",
    !folder.includes("stale-link") && folder.includes("about.txt"),
    folder.replace(/\n+/g, " · ")
  );

  t.check(
    "and a file this build cannot resolve does not reopen empty",
    !(await page.isVisible("#txtFile")),
    "the old shape carried no id, so there is nothing to look up"
  );

  const version = await page.evaluate(
    () => JSON.parse(localStorage.getItem("tanushos-v1")).version
  );
  t.check("and the saved state was migrated rather than dropped", version === 3, `v${version}`);
  await page.close();

  // ---------- a fresh save ----------
  page = await openPage(browser, {
    state: seed({ windows: { finder: win({ data: { ref: "about" } }) } }),
  });

  await page.dblclick("#finder .finder-body .content li >> nth=0");
  await page.waitForTimeout(700);
  t.check("a text file opens from the finder", await page.isVisible("#txtFile"));

  const saved = await storedState(page);
  t.check(
    "the folder is saved as a reference",
    JSON.stringify(saved.windows.finder.data) === '{"ref":"about"}',
    JSON.stringify(saved.windows.finder.data)
  );
  t.check(
    "and so is the file, with no words in it",
    saved.windows.txtFile.data?.ref && saved.windows.txtFile.data?.part === "data",
    JSON.stringify(saved.windows.txtFile.data)
  );

  const shown = await page.$eval("#txtFile .txt-body", (el) => el.innerText);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settled(page);

  t.check("the file is still open after a reload", await page.isVisible("#txtFile"));
  t.check(
    "showing the same thing, resolved fresh",
    (await page.$eval("#txtFile .txt-body", (el) => el.innerText)) === shown,
    shown.split("\n")[0]
  );

  t.check("no page errors", page.pageErrors.length === 0, page.pageErrors.join(" | "));
  await page.close();
};
