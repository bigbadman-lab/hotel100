/**
 * Minimal SQL executor shared by Postgres and PGlite adapters.
 * Do not invent connection strings — callers supply configuration.
 */
export type SqlQueryResult<T> = { rows: T[] };

export interface SqlExecutor {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<SqlQueryResult<T>>;
}
