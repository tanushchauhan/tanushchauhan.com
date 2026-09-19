# Tests

```bash
npm test                 # everything
npm test -- windows      # only specs whose filename contains "windows"
npm test -- --headed     # watch it happen in a real window
```

A dev server already listening on `localhost:5173` is reused; otherwise the
runner starts one and stops it afterwards. `TEST_URL=https://tanushchauhan.com
npm test` smoke-tests a deploy, though the specs that seed `localStorage`
assume a fresh browser profile.

Failing checks are screenshotted into `tests/screenshots/` (gitignored, cleared
each run).

## What it covers

Mostly behaviour that fails silently: the widget block clearing the dock, the
phone home page fitting with Safari's toolbars showing, stale probe readings,
text that should be selectable. The checks assert outcomes, like a 20px gap
above the dock, rather than which fit tier the layout picked.

## Layout

- `run.js`: the runner. Finds specs, ensures a server, opens one browser
- `lib/fixtures.js`: canned API responses, shaped like production
- `lib/harness.js`: page setup and shared helpers
- `specs/*.js`: one file per area, each exporting `name` and `run({ browser, t })`
- `../scripts/dev-server.js`: starting Vite and finding Chrome, shared with `npm run og`

A spec calls `t.check(name, ok, detail)`. Nothing throws, so a spec reports
every failure it finds.

It uses `playwright-core` with the Chrome already on the machine, so a checkout
downloads no browsers. CI passes its Chrome as `CHROME_PATH`.

## Known misses

The iPhone SE at 375x559 overflows the home page by about 86px with Safari's
toolbars showing. `specs/mobile.js` reports it as a note, not a failure.
