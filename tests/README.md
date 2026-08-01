# Tests

```bash
npm test                 # everything
npm test -- windows      # only specs whose filename contains "windows"
npm test -- --headed     # watch it happen in a real window
```

A dev server already listening on `localhost:5173` is reused and left alone.
Otherwise the runner starts one and stops it afterwards. Point it somewhere
else with `TEST_URL=https://tanushchauhan.com npm test` to smoke-test a deploy,
though the specs that seed `localStorage` assume a fresh browser profile.

Every failing check is photographed into `tests/screenshots/` (gitignored,
cleared at the start of each run). These assertions are mostly about layout and
interaction, and "the card overlapped the dock by 9px" is a sentence you can
act on only with the picture beside it.

## What this is for

Almost everything here protects a behaviour that **fails silently**. Nothing
throws when the widget block stops clearing the dock, when the home page starts
overflowing on an iPhone, when a stale probe reading starts passing itself off
as a live one, or when a CSS change makes the contact email uncopyable. You
find out weeks later from a screenshot, which is exactly how the dock collision
and the unselectable text both surfaced.

So the assertions are about behaviour, not implementation. They check that a
card clears the dock by at least 20px, not which fit tier it landed on; that
the home page fits, not which rung the ladder chose. Tier names change as the
design does, and a test that pins them fails for the wrong reason.

## Layout

- `run.js` — the runner: finds specs, ensures a server, opens one browser
- `lib/fixtures.js` — canned API responses
- `lib/harness.js` — page setup and the small helpers specs share
- `specs/*.js` — one file per area, each exporting `name` and `run({ browser, t })`
- `../scripts/dev-server.js` — starting Vite and finding Chrome, shared with `npm run og`

A spec calls `t.check(name, ok, detail)`. There are no assertions that throw:
a spec runs to the end and reports everything it found, because the second
failure is usually the one that explains the first.

## Two decisions worth knowing

**`playwright-core`, not `@playwright/test`.** The test runner package
downloads its own browser builds on install. This suite uses the Chrome that is
already on the machine, so a checkout costs nothing. What that gives up is
parallelism and a reporter, neither of which a suite this size misses. CI
installs a Chrome into a tool cache Playwright does not know to look in, so it
passes the path as `CHROME_PATH`.

**The API is always stubbed.** The dev server has no `GITHUB_TOKEN` and no
fleet reporting into it, so left alone it renders a smaller, emptier desktop
than production. That is not cosmetic: without the contributions heatmap the
card is 76px shorter, and 76px is most of the clearance the widget block has
above the dock. A layout test against the bare dev server would pass happily
while the deployed site collided.

## On CI

`.github/workflows/ci.yml` runs the suite on every push to main and every pull
request, alongside a build and a typecheck of the server. Coolify deploys from
main without waiting for any of it, so a red run is a warning about something
already shipping rather than a gate on shipping it. Screenshots of whatever
failed are uploaded as an artifact.

## Known misses

The iPhone SE at 375x559 still overflows the home page by about 86px with
Safari's toolbars showing. `specs/mobile.js` reports it as a note rather than a
failure, because closing it means dropping a widget card on the smallest
screens, and that is a design decision rather than a bug to be hidden by
loosening a threshold here.
