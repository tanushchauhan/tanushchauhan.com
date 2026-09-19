import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "url";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const versionOf = (name) =>
  JSON.parse(readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url))).version;

// SOURCE_COMMIT when the deploy passes it (the Docker build has no .git), else git
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
  define: {
    __BUILD__: JSON.stringify({
      commit: commit(),
      builtAt: new Date().toISOString(),
      react: versionOf("react"),
      vite: versionOf("vite"),
    }),
  },
  // in production one container serves both, so the app always calls /api
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
