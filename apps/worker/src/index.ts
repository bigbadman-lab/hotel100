/**
 * HOTEL worker — indexer (Gate E) + Room Service pipeline (Gate F).
 * Production persistence is Postgres only. Memory store is tests-only.
 * No entitlement API, frontend, or production launch in this process.
 */
import { hotelConfigFromEnv } from "@hotel100/config";
import {
  HOLDER_RECONCILE_INTERVAL_MS,
  LIVE_CONFIRMATIONS,
  PUBLIC_STALE_THRESHOLD_MS,
  WORKER_POLL_INTERVAL_MS,
} from "@hotel100/domain";
import { HotelIndexer } from "./indexer/index.js";
import { buildExclusionSet, type HotelIndexerConfig } from "./indexer/types.js";
import { createViemChainReader } from "./rpc/index.js";
import type { AddressHex } from "./rpc/types.js";
import { createProductionRuntime } from "./runtime/production.js";

function main(): void {
  const envConfig = hotelConfigFromEnv(process.env);
  console.log("[hotel100/worker] indexer + Room Service");
  console.log(`chainId=${envConfig.chainId} hotelLive=${envConfig.hotelLive}`);

  if (!envConfig.rpcUrl || !envConfig.tokenAddress || envConfig.hotelLaunchBlock === undefined) {
    console.log(
      "[hotel100/worker] Idle: HOTEL_RPC_URL / HOTEL_TOKEN_ADDRESS / HOTEL_LAUNCH_BLOCK unresolved.",
    );
    return;
  }
  if (!envConfig.databaseUrl) {
    console.log(
      "[hotel100/worker] Idle: DATABASE_URL unresolved. Production startup requires Postgres and will not use the in-memory test store.",
    );
    return;
  }

  const runtime = createProductionRuntime({ databaseUrl: envConfig.databaseUrl });
  const reader = createViemChainReader({
    rpcUrl: envConfig.rpcUrl,
    chainId: envConfig.chainId,
  });
  const indexerConfig: HotelIndexerConfig = {
    hotelTokenAddress: envConfig.tokenAddress as AddressHex,
    hotelLaunchBlock: envConfig.hotelLaunchBlock,
    hotelOpenBlock: envConfig.hotelOpenBlock ?? null,
    hotelOpenTimestamp: envConfig.hotelOpenTimestamp ?? null,
    liveConfirmations: LIVE_CONFIRMATIONS,
    publicStaleThresholdMs: PUBLIC_STALE_THRESHOLD_MS,
    roomServiceAddress: envConfig.roomServiceAddress as AddressHex | undefined,
    hoodLockAddress: envConfig.hoodLockAddress as AddressHex | undefined,
    ponsV2FactoryAddress: envConfig.ponsV2FactoryAddress as AddressHex | undefined,
    ponsV2RouterAddress: envConfig.ponsV2RouterAddress as AddressHex | undefined,
    ponsFeeEscrowAddress: envConfig.ponsFeeEscrowAddress as AddressHex | undefined,
    manualExclusions: envConfig.manualExclusions as AddressHex[],
  };
  const indexer = new HotelIndexer(reader, runtime.store, indexerConfig);
  void indexer;
  void buildExclusionSet;
  void WORKER_POLL_INTERVAL_MS;
  void HOLDER_RECONCILE_INTERVAL_MS;

  console.log(`[hotel100/worker] persistence=${runtime.mode} pollMs=${WORKER_POLL_INTERVAL_MS}`);
  if (!envConfig.roomServiceAddress || !envConfig.ponsFeeEscrowAddress) {
    console.log(
      "[hotel100/worker] Room Service collection idle: RoomService / Pons Fee Escrow address unresolved. No production address invented.",
    );
  }
  console.log("[hotel100/worker] Loop not auto-started. No production broadcast.");
}

main();
