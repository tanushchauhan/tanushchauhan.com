import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
