import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "url";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const versionOf = (name) =>
  JSON.parse(readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url))).version;

/* The commit comes from SOURCE_COMMIT when the deploy passes one (the Docker
   build has no .git to ask), and from git itself locally. Neither is an error:
   About This Mac just leaves the row out. */
const commit = () => {
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // what About This Mac reports about the build it is part of
  define: {
    __BUILD__: JSON.stringify({
      commit: commit(),
      builtAt: new Date().toISOString(),
      react: versionOf("react"),
      vite: versionOf("vite"),
    }),
  },
  // in dev the frontend runs on Vite and the API on Bun; in production a single
  // container serves both from the same origin, so app code always calls /api/*
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "#components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "#constants": fileURLToPath(new URL("./src/constants", import.meta.url)),
      "#store": fileURLToPath(new URL("./src/store", import.meta.url)),
      "#hoc": fileURLToPath(new URL("./src/hoc", import.meta.url)),
      "#windows": fileURLToPath(new URL("./src/windows", import.meta.url)),
    },
  },
});
