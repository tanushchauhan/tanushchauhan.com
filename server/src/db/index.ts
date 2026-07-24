import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.ts";

const url = Bun.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// one modest pool: a single container serving a personal site does not need more
const sql = postgres(url, { max: 5, onnotice: () => {} });

export const db = drizzle(sql, { schema });

/**
 * Applied on startup before the server listens. Safe to run every boot since
 * Drizzle records which migrations have already been applied, and this is a
 * single-instance deployment so there is no racing writer.
 */
export const runMigrations = async () => {
  await migrate(db, { migrationsFolder: `${import.meta.dir}/../../drizzle` });
};

export const closeDb = () => sql.end({ timeout: 5 });
