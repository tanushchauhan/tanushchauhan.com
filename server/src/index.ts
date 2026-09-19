import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { runMigrations } from "./db/index.ts";
import { authRoutes } from "./routes/auth.ts";
import { guestbookRoutes } from "./routes/guestbook.ts";
import { widgetRoutes } from "./routes/widgets.ts";
import { moontowerRoutes } from "./routes/moontower.ts";
import { visitRoutes } from "./routes/visit.ts";
import { startMetricsSampler } from "./lib/metrics.ts";
import { startServiceProbes } from "./lib/probes.ts";

const PORT = Number(Bun.env.PORT ?? 3001);

// same origin as the API, so there is no CORS and the RP ID is simple
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
api.route("/widgets", widgetRoutes);
api.route("/moontower", moontowerRoutes);
api.route("/visit", visitRoutes);

app.route("/api", api);

// unmatched API routes must 404 as JSON, never fall through to the SPA shell
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

/* ---------- static frontend ---------- */

// hashed assets are immutable, the HTML shell is never cached, the rest gets an hour
app.use("/*", async (c, next) => {
  await next();
  if (c.req.method !== "GET" || !c.res.ok) return;
  if (c.res.headers.has("cache-control")) return;

  const isHtml = c.res.headers.get("content-type")?.includes("text/html");
  c.res.headers.set(
    "cache-control",
    isHtml
      ? "no-cache"
      : c.req.path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600"
  );
});

app.use("/*", serveStatic({ root: DIST }));

// missing files 404 instead of falling through to the SPA shell
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

app.get("*", serveStatic({ path: `${DIST}/index.html` }));

await runMigrations();

startMetricsSampler();
startServiceProbes();

// warn rather than exit: the public site works without it, login does not
if (!Bun.env.SESSION_SECRET) {
  console.warn(
    "SESSION_SECRET is not set: passkey login is disabled. Generate one with `openssl rand -base64 32`."
  );
}

console.log(`server listening on http://localhost:${PORT}`);

export default { port: PORT, fetch: app.fetch };
