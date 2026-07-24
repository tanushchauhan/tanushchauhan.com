import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // process.env, not Bun.env: drizzle-kit's CLI runs under Node
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://tanush:localdev@127.0.0.1:5432/tanushchauhan",
  },
});
