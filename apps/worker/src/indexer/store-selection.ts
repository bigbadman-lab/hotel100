import type { HotelConfig } from "@hotel100/config";
import { createMemoryIndexerStore } from "./memory-store.js";
import { createPostgresIndexerStore } from "./postgres-store.js";
import type { SqlExecutor } from "./sql.js";
import type { IndexerStore } from "./types.js";

export type IndexerStoreSelection =
  | { mode: "postgres"; store: IndexerStore }
  | { mode: "memory"; store: IndexerStore; reason: string };

/**
 * Select indexer persistence backend.
 *
 * - When database configuration is present (DATABASE_URL / explicit executor),
 *   ALWAYS use Postgres — never silently fall back to volatile memory.
 * - Memory store is for deterministic unit tests only (explicit allowMemory).
 */
export function selectIndexerStore(args: {
  config: Pick<HotelConfig, "databaseUrl">;
  /** Injected executor (PGlite / pool). Required when databaseUrl is set unless omitted for error path tests. */
  executor?: SqlExecutor;
  /** Unit tests only — refuse in production-shaped configs. */
  allowMemoryForTests?: boolean;
}): IndexerStoreSelection {
  const dbUrl = args.config.databaseUrl?.trim();

  if (dbUrl) {
    if (!args.executor) {
      throw new Error(
        "DATABASE_URL / database config is set but no SQL executor was provided — refusing silent memory fallback",
      );
    }
    return { mode: "postgres", store: createPostgresIndexerStore(args.executor) };
  }

  if (args.executor && !args.allowMemoryForTests) {
    // Executor provided without URL — treat as intentional Postgres (e.g. PGlite tests / injected pool).
    return { mode: "postgres", store: createPostgresIndexerStore(args.executor) };
  }

  if (args.allowMemoryForTests) {
    return {
      mode: "memory",
      store: createMemoryIndexerStore(),
      reason: "explicit allowMemoryForTests",
    };
  }

  throw new Error(
    "No database configuration present and memory store not explicitly allowed — set DATABASE_URL for production persistence",
  );
}

export function requirePostgresIndexerStore(executor: SqlExecutor): IndexerStore {
  return createPostgresIndexerStore(executor);
}
