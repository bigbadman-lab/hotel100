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
import type { HotelIndexerConfig } from "./indexer/types.js";
import type { RoomServiceWorker } from "./room-service/index.js";
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
  const indexer = new HotelIndexer(reader, runtime.store, indexerConfig, {
    db: runtime.executor,
  });

  const roomService = tryWireRoomServiceWorker({
    roomServiceAddress: envConfig.roomServiceAddress,
    ponsFeeEscrowAddress: envConfig.ponsFeeEscrowAddress,
    hotelOpenTimestamp: envConfig.hotelOpenTimestamp,
  });

  console.log(`[hotel100/worker] persistence=${runtime.mode} pollMs=${WORKER_POLL_INTERVAL_MS}`);
  console.log(
    `[hotel100/worker] Starting poll loop (reconcile every ${HOLDER_RECONCILE_INTERVAL_MS}ms). No invented broadcast.`,
  );

  let lastReconcileAtMs = 0;
  let tickInFlight = false;

  const poll = async (opts: { restart?: boolean } = {}): Promise<void> => {
    if (tickInFlight) {
      console.log("[hotel100/worker] poll skipped: previous tick still in flight");
      return;
    }
    tickInFlight = true;
    const nowMs = Date.now();
    try {
      const forceReconcile =
        !opts.restart && nowMs - lastReconcileAtMs >= HOLDER_RECONCILE_INTERVAL_MS;
      const result = opts.restart
        ? await indexer.onRestart(nowMs)
        : await indexer.runOnce(nowMs, { forceReconcile });
      if (opts.restart || result.reconciled || forceReconcile) {
        lastReconcileAtMs = nowMs;
      }
      console.log(
        `[hotel100/worker] poll ok advanced=${result.advanced} transfers=${result.transfersApplied} checkInEventsApplied=${result.checkInEventsApplied} reconciled=${result.reconciled} ranking=${result.rankingCount} status=${result.publicStatus}`,
      );

      if (roomService) {
        const rs = await roomService.run(nowMs);
        console.log(
          `[hotel100/worker] roomService attempts=${rs.attempts.length} delayed=${rs.delayed} stuck=${rs.stuck}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[hotel100/worker] poll error: ${message}`);
    } finally {
      tickInFlight = false;
    }
  };

  void poll({ restart: true });
  setInterval(() => {
    void poll();
  }, WORKER_POLL_INTERVAL_MS);
}

/**
 * Wire RoomServiceWorker when addresses + open timestamp resolve AND production
 * FeeCollector / financial-reader factories exist. Today those factories are absent
 * (see room-service/collection.ts) — do not invent addresses or writer keys.
 */
function tryWireRoomServiceWorker(args: {
  roomServiceAddress: string | undefined;
  ponsFeeEscrowAddress: string | undefined;
  hotelOpenTimestamp: number | undefined;
}): RoomServiceWorker | null {
  const ready =
    Boolean(args.roomServiceAddress) &&
    Boolean(args.ponsFeeEscrowAddress) &&
    args.hotelOpenTimestamp !== undefined &&
    args.hotelOpenTimestamp !== null;

  if (!ready) {
    console.log(
      "[hotel100/worker] Room Service collection idle: RoomService / Pons Fee Escrow / HOTEL_OPEN_TIMESTAMP unresolved. No production address invented.",
    );
    return null;
  }

  console.log(
    "[hotel100/worker] Room Service collection idle: FeeCollector / financial-reader production factories unresolved (no broadcast path without writer key). Indexer loop continues.",
  );
  return null;
}

main();
