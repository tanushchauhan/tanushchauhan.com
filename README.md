# tanushchauhan.com 🤘

[![CI](https://github.com/tanushchauhan/tanushchauhan.com/actions/workflows/ci.yml/badge.svg)](https://github.com/tanushchauhan/tanushchauhan.com/actions/workflows/ci.yml)

A personal site that does not behave like a website. It boots like a Mac, and
then it is one: windows, a Finder, a terminal that actually runs commands, and
a row of widgets fed by a small API. Built by
[Tanush Chauhan](https://github.com/tanushchauhan) (CS Honors + Math @ UT
Austin), and live at [tanushchauhan.com](https://tanushchauhan.com).

## What is inside

**The desktop**

- A boot screen, once per session, with a chime if sound is on
- Wallpapers that come in light and dark pairs, chosen from a Control Center
  that also holds the theme and the sound switch
- Windows you can drag by the title bar, resize from any edge or corner,
  minimize into the dock and maximize. Positions and sizes survive a reload.
- A Finder with Projects, Publications, About Me and Trash, plus Spotlight
  (press ⌘K) that searches all of it
- Safari, holding a short reading list of the things I would point at first
- A gallery of poster cards, and a right-click menu on the desktop
- A separate phone layout: a springboard with pages, a dock and app sheets,
  showing the same content

**The terminal**

A real shell over a virtual filesystem that mirrors the Finder. `ls`, `cd`,
`cat`, `grep`, `open` (which opens the real window), tab completion, history,
and a session that survives reloads. `visitor` tells you which number you
are. Also `neofetch`, `cowsay`, `fortune`, `matrix` and `snake`, because it
would be a poor terminal without them.

**Things that talk to a server**

- A guestbook anyone can write in. Rate limited by a salted hash of the
  address, with a honeypot field for bots and moderation from the terminal.
- A visitor counter keyed by that same hash, which stores nothing else about
  anyone
- Live widgets: the time in Austin, GitHub contributions and the latest
  commit (proxied and cached so the token never leaves the server), and a
  "now building" line I can change with one terminal command
- Passkey login. There is exactly one user, so there is no password anywhere:
  Touch ID or Face ID through WebAuthn, with a break-glass enrollment token
  that can only be minted from inside the container.
- Moontower, a small fleet monitor. A POSIX `sh` agent on each machine reads
  `/proc` every 30 seconds and posts one request; the hub probes the sites
  themselves over HTTP. Signed in, the desktop grows a card per machine.

## Stack

Frontend: React 19, Vite, Tailwind CSS v4, GSAP (with Draggable), Zustand with
Immer, lucide-react.

Backend: Bun, Hono, Drizzle over Postgres, SimpleWebAuthn.

Deployment: one Docker image built from the `Dockerfile`, run by Coolify
behind Cloudflare. The API and the frontend share an origin, so there is no
CORS to configure.

## Run it

The frontend on its own is enough to see the desktop. The widgets render their
empty states and the guestbook says it cannot reach the server, which is
accurate.

```bash
npm install
npm run dev              # http://localhost:5173
```

For the whole thing, the API needs a Postgres and a few environment variables:

```bash
docker compose up -d db          # Postgres on 127.0.0.1:5432, local only
cp .env.example .env             # matches the compose database out of the box
cd server && bun install && cd ..
npm run dev:api                  # Hono on http://localhost:3001
npm run dev                      # Vite proxies /api to it
```

`docker compose up --build` builds and runs the real image on port 3001, which
is how to check the `Dockerfile` before a deploy.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | the API, restarting on change |
| `npm run build` | production build into `dist/` |
| `npm start` | the API serving `dist/`, which is what the container runs |
| `npm test` | the browser suite, starting a dev server if none is up |
| `npm run typecheck` | the server's TypeScript |
| `npm run og` | reshoot the social preview image |
| `npm run admin:token` | mint a passkey enrollment token |
| `npm run admin:enroll` | mint a Moontower enrollment token |

## Configuration

Everything is read from the environment. `.env.example` documents each one;
the short version:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | signs session cookies and salts the guestbook hashes. Generate one with `openssl rand -base64 32`. Without it login is disabled and the site still works. |
| `RP_ID`, `ORIGIN` | the WebAuthn relying party. Passkeys are bound to these, so a credential made on localhost will not work on the real domain. |
| `TRUST_PROXY` | `true` behind Cloudflare or Traefik, so the rate limiter reads the caller's address from the proxy headers |
| `GITHUB_TOKEN` | optional, read-only. The contributions calendar only exists in GitHub's GraphQL API, which needs a token even for public data. |
| `PORT` | defaults to 3001 |

Never commit `.env`. It is ignored, and `.env.example` is the template.

## Signing in

The first passkey has to be enrolled with a token, and the only way to get one
is a shell on the container. That is deliberate: the site is reachable from the
internet before the first passkey exists, and an open registration endpoint
would hand admin to whoever called it first.

```bash
docker exec -it <container> bun server/src/admin/token.ts
```

Then, in the site's terminal, `enroll <token>` and follow the Touch ID prompt.
After that `sudo` logs in. Being signed in unlocks the moderation commands
(`guestbook`), the `building` line, `passkeys`, and the Moontower commands.

## Moontower

Adding a machine is a terminal command, `moontower enroll <name>`, which mints
a single-use token and prints an install one-liner to run on the box. The
installer creates an unprivileged user, drops one shell script in
`/usr/local/lib/moontower`, enrolls, writes the key to a `0600` config file and
schedules a systemd timer (or cron). `services add <name> <url>` puts a site on
the probe list.

The agent has no channel through which the hub can run anything on it. The
hub's reply is configuration and a version string, and which systemd units are
reported is set in the config file on the machine, never sent from the hub. An
auto-updating agent would turn a compromise of a portfolio site into root on a
mail server, which is not a trade worth making. The scripts are in
`public/moontower/` and are short enough to read before running them.

## Tests

`npm test` drives the real Chrome on your machine against the running site,
through `playwright-core`, so a checkout downloads no browsers. Every failing
check is photographed into `tests/screenshots/`. See
[`tests/README.md`](tests/README.md) for what the suite protects and why it is
built the way it is. The same suite, plus a build and a typecheck, runs on
every push and pull request through
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

The link preview at `public/images/og.png` is a screenshot of the desktop
rather than a designed card. Reshoot it with `npm run og` after anything that
changes the furniture, and note that scrapers cache hard: Facebook and LinkedIn
keep the old one for days unless you poke their URL debuggers.

## Layout

```
src/            the desktop: components, windows, the Zustand store
src/constants/  every project, paper, highlight and file the site shows
server/src/     Hono routes, auth, the Moontower hub, the metrics sampler
server/drizzle/ migrations, applied on startup
public/         static assets, the poster SVGs, the Moontower scripts
scripts/        the dev server helper and the OG image shot
tests/          the browser suite
```

## Make it yours

Almost everything personal lives in `src/constants/index.js`: projects,
publications, highlights, socials, tech stack, and the Finder file system. The
poster SVGs are in `public/images/posters/` and the wallpapers in
`public/images/`.

Beyond that file, the names to change are `GITHUB_USER` in
`server/src/routes/widgets.ts`, the relying party name and user in
`server/src/auth/webauthn.ts`, the hub address at the top of
`public/moontower/install.sh`, and the metadata in `index.html`,
`public/sitemap.xml` and `public/robots.txt`.

## Credits

The starting point was JavaScript Mastery's video
[Build and Deploy a MacOS style Portfolio with React, GSAP & Tailwind](https://www.youtube.com/watch?v=j9ZD_hlyHOA).
The nameplate's per-character hover and the shape of the dock still come from
it. Nearly everything else has been rebuilt since, but that is where this began.

## License

The code is MIT licensed, see `LICENSE`. The photos, the poster art, the
wallpapers and the words are mine and are not covered by it: build your own
desktop with this, but put your own things in it.
