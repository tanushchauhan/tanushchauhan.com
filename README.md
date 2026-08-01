# tanushchauhan.com 🤘

[![CI](https://github.com/tanushchauhan/tanushchauhan.com/actions/workflows/ci.yml/badge.svg)](https://github.com/tanushchauhan/tanushchauhan.com/actions/workflows/ci.yml)

A personal portfolio that doesn't behave like a website — it boots like an
operating system. Built by [Tanush Chauhan](https://github.com/tanushchauhan)
(CS Honors + Math @ UT Austin '29).

## What's inside

- **Boot screen** — the site powers on like a Mac before the desktop fades in (once per session)
- **Texas-sunset desktop** — custom SVG wallpaper, draggable project folders, live menu-bar clock
- **Interactive terminal** — a real shell, not a mockup. Try `help`, `whoami`, `neofetch`, `projects`, or `sudo hire-tanush`
- **Finder** — browse Projects / About Me / Résumé / Trash, open txt & image files
- **Safari** — "Highlights" reading list (ACL 2025 publication, hackathon wins, research)
- **Gallery** — poster cards for every project and award
- **Résumé viewer** — rendered PDF with a download button
- **Real window management** — draggable, focusable, stackable windows via a Zustand store and a `WindowWrapper` HOC

## Stack

React 19 · Vite · Tailwind CSS v4 · GSAP (+ Draggable) · Zustand + Immer · react-pdf · lucide-react

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # browser tests, starts a dev server if none is up
npm run typecheck  # the server's TypeScript
npm run og         # re-shoot the social preview image
```

`npm test` drives a real Chrome against the running site. See
[`tests/README.md`](tests/README.md) for what it covers and why it is built the
way it is. The same three run on every push and pull request through
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

The link preview at `public/images/og.png` is a screenshot of the live desktop
rather than a designed card. Reshoot it with `npm run og` after anything that
changes the desktop's furniture, and note that scrapers cache hard: Facebook
and LinkedIn keep the old one for days unless you poke their URL debuggers.

## Make it yours

Almost everything personal lives in `src/constants/index.js` — projects,
highlights, socials, tech stack, and the Finder file system. The gallery
poster SVGs are in `public/images/posters/`, and the résumé is
`public/files/resume.pdf`.
