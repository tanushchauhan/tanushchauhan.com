import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.ts";

const url = Bun.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { max: 5, onnotice: () => {} });

export const db = drizzle(sql, { schema });

export const runMigrations = async () => {
  await migrate(db, { migrationsFolder: `${import.meta.dir}/../../drizzle` });
};

export const closeDb = () => sql.end({ timeout: 5 });
