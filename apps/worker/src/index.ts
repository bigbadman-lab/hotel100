/**
 * HOTEL worker — Gate E indexer entry.
 * Room Service finalization / Pons collection are Gate F+ (not started).
 *
 * Persistence: when DATABASE_URL is present, Postgres IndexerStore is required
 * (never silently falls back to volatile memory).
 */
import { hotelConfigFromEnv } from "@hotel100/config";
import {
  HOLDER_RECONCILE_INTERVAL_MS,
  LIVE_CONFIRMATIONS,
  PUBLIC_STALE_THRESHOLD_MS,
} from "@hotel100/domain";
import { HotelIndexer, selectIndexerStore } from "./indexer/index.js";
import { createViemChainReader } from "./rpc/index.js";
import type { AddressHex } from "./rpc/types.js";

function main(): void {
  const envConfig = hotelConfigFromEnv(process.env);
  console.log("[hotel100/worker] Gate E indexer service");
  console.log(`chainId=${envConfig.chainId} hotelLive=${envConfig.hotelLive}`);

  if (!envConfig.rpcUrl || !envConfig.tokenAddress || envConfig.hotelLaunchBlock === undefined) {
    console.log(
      "[hotel100/worker] Idle: HOTEL_RPC_URL / HOTEL_TOKEN_ADDRESS / HOTEL_LAUNCH_BLOCK unresolved — no production values invented.",
    );
    return;
  }

  if (!envConfig.databaseUrl) {
    console.log(
      "[hotel100/worker] Idle: DATABASE_URL unresolved — production indexer requires Postgres persistence (Gate D schema). Memory store is tests-only.",
    );
    return;
  }

  // Production path requires an injected SQL pool/executor at process wiring time.
  // Refusing to invent credentials or silently use memory.
  try {
    selectIndexerStore({ config: envConfig });
  } catch (err) {
    console.log(
      `[hotel100/worker] Postgres store required but executor not wired in this entrypoint: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    console.log(
      "[hotel100/worker] Wire a SQL executor (pg pool) with selectIndexerStore({ config, executor }) before starting the loop.",
    );
  }

  const reader = createViemChainReader({
    rpcUrl: envConfig.rpcUrl,
    chainId: envConfig.chainId,
  });
  void reader;
  void HotelIndexer;
  void LIVE_CONFIRMATIONS;
  void PUBLIC_STALE_THRESHOLD_MS;
  void HOLDER_RECONCILE_INTERVAL_MS;

  console.log(
    `[hotel100/worker] Configured for Postgres-backed indexer (token=${envConfig.tokenAddress}, launchBlock=${envConfig.hotelLaunchBlock})`,
  );
  console.log(
    "[hotel100/worker] Long-running loop not auto-started without explicit operator run flag + SQL executor.",
  );
}

main();

// Re-export for operators / tests
export type { AddressHex };
