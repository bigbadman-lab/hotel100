import { Pool } from "pg";
import type { SqlExecutor } from "../indexer/sql.js";

/**
 * Production SQL executor from DATABASE_URL.
 * Connection string is never logged. No in-memory fallback.
 */
export function createPgSqlExecutor(databaseUrl: string): SqlExecutor {
  const url = databaseUrl.trim();
  if (!url) {
    throw new Error("DATABASE_URL is unresolved — refusing to invent a database connection");
  }
  const pool = new Pool({ connectionString: url, max: 4 });
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}
