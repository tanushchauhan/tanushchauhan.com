import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";

const PORT = Number(Bun.env.PORT ?? 3000);

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

app.route("/api", api);

// unmatched API routes must 404 as JSON, never fall through to the SPA shell
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

/* ---------- static frontend ---------- */
app.use("/*", serveStatic({ root: DIST }));

// SPA fallback: every non-asset path renders the desktop
app.get("*", async (c, next) => {
  const index = Bun.file(`${DIST}/index.html`);
  if (!(await index.exists())) {
    return c.text(
      "No build found. Run `npm run build` first, or use `npm run dev` for the Vite dev server.",
      503
    );
  }
  return next();
});
app.get("*", serveStatic({ path: `${DIST}/index.html` }));

console.log(`server listening on http://localhost:${PORT}`);

export default { port: PORT, fetch: app.fetch };
