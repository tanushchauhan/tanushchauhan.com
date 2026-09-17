# Security

This repository runs a live site with a small backend: a guestbook anyone can
write to, a passkey login, and a monitoring hub that machines report into. If
you find a way to do something it should not allow, I would like to hear about
it before anyone else does.

## Reporting

Email [tanush@utexas.edu](mailto:tanush@utexas.edu) with what you found and how
to reproduce it. Please do not open a public issue for anything that could be
used against the live site before it is fixed. I will reply as soon as I can,
usually within a few days, and I will say what I did about it.

## In scope

- The site and its API at `tanushchauhan.com`
- The Moontower agent and installer in `public/moontower/`, and the hub routes
  under `server/src/routes/moontower.ts`
- The passkey login and session handling in `server/src/auth/`

## Please avoid

- Filling the guestbook with test entries. The rate limiter is there to be
  tested, but a page of junk is a page I have to clean up by hand.
- Anything that would degrade the site for other visitors.
- Enrolling machines into the hub that you do not control.

## Out of scope

- The upstream services the site talks to (GitHub, Cloudflare, Coolify)
- Findings that need a valid session cookie or a registered passkey to begin
  with, since there is exactly one user and that user is me
