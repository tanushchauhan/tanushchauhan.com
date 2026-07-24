# syntax=docker/dockerfile:1

# ---------- stage 1: build the frontend ----------
FROM oven/bun:1-alpine AS web
WORKDIR /build

# lockfile first so dependency layers cache across source-only changes
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY index.html jsconfig.json vite.config.js ./
COPY public ./public
COPY src ./src
RUN bun run build

# ---------- stage 2: server dependencies only ----------
FROM oven/bun:1-alpine AS server-deps
WORKDIR /build/server
COPY server/package.json server/bun.lock* ./
RUN bun install --frozen-lockfile --production

# ---------- stage 3: runtime ----------
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001

COPY --from=server-deps /build/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=web /build/dist ./dist

# oven/bun images ship a non-root `bun` user
USER bun

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["bun", "server/src/index.ts"]
