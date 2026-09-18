import type { SqlExecutor } from "../indexer/sql.js";
import { selectIndexerStore } from "../indexer/store-selection.js";
import type { IndexerStore } from "../indexer/types.js";
import { createPgSqlExecutor } from "./pg-executor.js";

export type ProductionRuntime = {
  mode: "postgres";
  store: IndexerStore;
  executor: SqlExecutor;
};

/**
 * Production worker persistence wiring.
 * DATABASE_URL selects Postgres only. Memory store is never returned.
 */
export function createProductionRuntime(args: {
  databaseUrl: string;
  /** Test/injection override. Production omits this and opens a pg pool. */
  executor?: SqlExecutor;
}): ProductionRuntime {
  const databaseUrl = args.databaseUrl.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL unresolved — production runtime requires Postgres");
  }
  const executor = args.executor ?? createPgSqlExecutor(databaseUrl);
  const selected = selectIndexerStore({
    config: { databaseUrl },
    executor,
  });
  if (selected.mode !== "postgres") {
    throw new Error("production runtime refused non-postgres indexer store");
  }
  return { mode: "postgres", store: selected.store, executor };
}
