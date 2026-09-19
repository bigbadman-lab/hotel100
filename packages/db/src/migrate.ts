import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../../supabase/migrations");

/** Apply HOTEL SQL migrations in filename order to an in-memory PGlite DB. */
export async function applyHotelMigrations(db: PGlite = new PGlite()): Promise<PGlite> {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.exec(sql);
  }
  return db;
}

export const FIXTURE_ADDR = {
  a: "0x0000000000000000000000000000000000000001",
  b: "0x0000000000000000000000000000000000000002",
  mixed: "0x00000000000000000000000000000000000000Aa",
} as const;
