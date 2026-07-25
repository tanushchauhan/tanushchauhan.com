import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { runMigrations } from "./db/index.ts";
import { authRoutes } from "./routes/auth.ts";
import { guestbookRoutes } from "./routes/guestbook.ts";

const PORT = Number(Bun.env.PORT ?? 3001);

// Vite's build output, resolved from the process cwd (the repo root locally,
// /app in the container). The API and the frontend are deliberately the same
// origin so there is no CORS config and the WebAuthn RP ID stays trivial.
const DIST = "./dist";

const startedAt = Date.now();
const app = new Hono();

if (Bun.env.NODE_ENV !== "production") app.use("*", logger());

/* ---------- API ---------- */
const api = new Hono();

api.get("/health", (c) =>
  c.json({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    env: Bun.env.NODE_ENV ?? "development",
  })
);

api.route("/auth", authRoutes);
api.route("/guestbook", guestbookRoutes);

app.route("/api", api);

// unmatched API routes must 404 as JSON, never fall through to the SPA shell
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

/* ---------- static frontend ---------- */
app.use("/*", serveStatic({ root: DIST }));

// A request for a file that does not exist must 404 rather than fall through
// to the SPA shell. Without this a missing image returns 200 with a page of
// HTML, so broken assets look fine to monitoring and to crawlers.
const ASSET_PATH = /^\/(assets|images|icons|files)\//;
const HAS_EXTENSION = /\.[a-z0-9]{2,5}$/i;

app.get("*", async (c, next) => {
  const path = c.req.path;
  if (ASSET_PATH.test(path) || HAS_EXTENSION.test(path)) {
    return c.text("Not found", 404);
  }

  const index = Bun.file(`${DIST}/index.html`);
  if (!(await index.exists())) {
    return c.text(
      "No build found. Run `npm run build` first, or use `npm run dev` for the Vite dev server.",
      503
    );
  }
  return next();
});

// SPA fallback: every remaining path renders the desktop
app.get("*", serveStatic({ path: `${DIST}/index.html` }));

// migrations complete before the first request is served
await runMigrations();

// Warn rather than throw: a missing secret breaks logging in, but the public
// portfolio is fine without it, and taking the whole site down over an auth
// misconfiguration would be the worse failure. Sessions refuse to sign
// themselves at the point of use, so this cannot fail silently either.
if (!Bun.env.SESSION_SECRET) {
  console.warn(
    "SESSION_SECRET is not set: passkey login is disabled. Generate one with `openssl rand -base64 32`."
  );
}

console.log(`server listening on http://localhost:${PORT}`);

export default { port: PORT, fetch: app.fetch };
