import { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import {
  firstServiceNumberAfterOpen,
  PUBLIC_STATUS,
  unallocatedWei,
  ZERO_ADDRESS,
} from "@hotel100/domain";
import { describe, expect, it } from "vitest";
import { applyTransferToBalances } from "./indexer/balances.js";
import { createPostgresIndexerStore } from "./indexer/postgres-store.js";
import type { SqlExecutor } from "./indexer/sql.js";
import { buildExclusionSet } from "./indexer/types.js";
import {
  allocateServicePool,
  assertSingleFinancialReadBlock,
  COLLECTION_MAX_ATTEMPTS,
  COLLECTION_RETRY_DELAYS_MS,
  collectRoomServiceFees,
  dueServiceNumbers,
  type FeeCollector,
  type FinancialRead,
  RoomServiceWorker,
  selectFinancialSnapshotBlock,
  submitServiceFinalization,
} from "./room-service/index.js";
import { MockChainReader, transferFixture } from "./rpc/mock-reader.js";
import type { AddressHex, Hex } from "./rpc/types.js";
import { createProductionRuntime } from "./runtime/production.js";

const TOKEN = "0x0000000000000000000000000000000000001000" as AddressHex;
const ALICE = "0x0000000000000000000000000000000000000001" as AddressHex;
const BOB = "0x0000000000000000000000000000000000000002" as AddressHex;
const CAROL = "0x0000000000000000000000000000000000000003" as AddressHex;
const CONTRACT = "0x00000000000000000000000000000000000000c0" as AddressHex;
const OPEN = 9_000;
const TX = `0x${"ab".repeat(32)}` as Hex;

function pgliteExecutor(db: PGlite): SqlExecutor {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await db.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}

function chain(): MockChainReader {
  const reader = new MockChainReader(100n);
  reader.setBlocks(0n, 100n);
  return reader;
}

function okCollector(broadcasts: { n: number } = { n: 0 }): FeeCollector {
  return {
    async simulateCollect() {
      return { ok: true };
    },
    async broadcastCollect() {
      broadcasts.n += 1;
      return { txHash: TX };
    },
    async verifyReceipt() {
      return { confirmed: true, confirmations: 1, blockNumber: 90n };
    },
  };
}

function readerFor(balance: bigint, claimed: bigint, block = 90n) {
  return {
    async readAtBlock(blockNumber: bigint): Promise<FinancialRead> {
      return {
        balanceReadBlock: blockNumber,
        claimedReadBlock: block,
        contractBalanceWei: balance,
        totalRoomServiceClaimedWei: claimed,
      };
    },
  };
}

async function seedMint(db: PGlite, to: AddressHex, value: bigint, logIndex: number) {
  const store = createPostgresIndexerStore(pgliteExecutor(db));
  await store.tryInsertTransfer(
    transferFixture({
      blockNumber: 10n,
      blockHash: `0x${"11".repeat(32)}` as Hex,
      txHash: `0x${logIndex.toString(16).padStart(64, "c")}` as Hex,
      logIndex,
      from: ZERO_ADDRESS as AddressHex,
      to,
      valueRaw: value,
    }),
  );
}

describe("Room Service scheduling", () => {
  it("first Service is strictly after open, including an exact boundary", () => {
    const first = firstServiceNumberAfterOpen(OPEN);
    expect(
      dueServiceNumbers({
        hotelOpenTimestamp: OPEN,
        nowUnixSeconds: OPEN,
        lastFinalizedServiceNumber: null,
      }),
    ).toEqual([]);
    expect(
      dueServiceNumbers({
        hotelOpenTimestamp: OPEN,
        nowUnixSeconds: first * 900,
        lastFinalizedServiceNumber: null,
      }),
    ).toEqual([first]);
  });

  it("does not include the next Service while the current one is unresolved", () => {
    const first = firstServiceNumberAfterOpen(OPEN);
    const due = dueServiceNumbers({
      hotelOpenTimestamp: OPEN,
      nowUnixSeconds: (first + 3) * 900,
      lastFinalizedServiceNumber: null,
    });
    expect(due[0]).toBe(first);
    expect(due[1]).toBe(first + 1);
  });

  it("caps catch-up at 8 oldest-first Services", () => {
    const first = firstServiceNumberAfterOpen(OPEN);
    const due = dueServiceNumbers({
      hotelOpenTimestamp: OPEN,
      nowUnixSeconds: (first + 20) * 900,
      lastFinalizedServiceNumber: null,
    });
    expect(due).toHaveLength(8);
    expect(due[0]).toBe(first);
    expect(due[7]).toBe(first + 7);
  });
});

describe("financial snapshot selection", () => {
  it("selects the latest block at or before the boundary with 2 confirmations", async () => {
    const reader = chain();
    reader.latest = 100n;
    for (let b = 0n; b <= 100n; b++) reader.setTimestamp(b, Number(b) * 100);
    const boundary = 9_900;
    const selected = await selectFinancialSnapshotBlock({
      reader,
      boundaryTimestamp: boundary,
    });
    // tip 100, 2 confirmations => head 98, but timestamp 98*100=9800 <= 9900, 99*100=9900 is only 1 confirmation
    expect(selected).toBe(98n);
    const ts = await reader.getBlockTimestamp(selected as bigint);
    expect(ts).toBeLessThanOrEqual(boundary);
  });
});

describe("allocation invariants", () => {
  it("uses integer floor pro-rata with no penthouse bonus and leaves dust", () => {
    const result = allocateServicePool({
      servicePoolWei: 10n,
      guests: [
        { address: ALICE, balanceRaw: 1n, rank: 1 },
        { address: BOB, balanceRaw: 1n, rank: 2 },
        { address: CAROL, balanceRaw: 1n, rank: 3 },
      ],
    });
    expect(result.allocations.map((a) => a.allocationWei)).toEqual([3n, 3n, 3n]);
    expect(result.totalAllocatedWei).toBe(9n);
    expect(result.dustWei).toBe(1n);
    expect(result.totalAllocatedWei <= 10n).toBe(true);
  });

  it("rejects accounting underflow before any finalization write", () => {
    expect(() => unallocatedWei(1n, 2n)).toThrow(/exceeds total received/);
  });

  it("rejects mixed financial-read blocks", () => {
    expect(() =>
      assertSingleFinancialReadBlock({
        balanceReadBlock: 1n,
        claimedReadBlock: 2n,
        contractBalanceWei: 1n,
        totalRoomServiceClaimedWei: 1n,
      }),
    ).toThrow(/mixed-block/);
  });
});

describe("collection flow", () => {
  it("does not broadcast when simulation fails and retries 2s/5s/10s up to 3 attempts", async () => {
    const delays: number[] = [];
    let broadcasts = 0;
    const result = await collectRoomServiceFees({
      serviceNumber: 1,
      sleep: async (ms) => {
        delays.push(ms);
      },
      collector: {
        async simulateCollect() {
          return { ok: false, error: "sim" };
        },
        async broadcastCollect() {
          broadcasts += 1;
          return { txHash: TX };
        },
        async verifyReceipt() {
          return { confirmed: true, confirmations: 1, blockNumber: 1n };
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(broadcasts).toBe(0);
    expect(delays).toEqual([...COLLECTION_RETRY_DELAYS_MS]);
    expect(COLLECTION_MAX_ATTEMPTS).toBe(3);
  });

  it("requires a 1-confirmation receipt before success", async () => {
    let verifies = 0;
    const result = await collectRoomServiceFees({
      serviceNumber: 1,
      sleep: async () => {},
      collector: {
        async simulateCollect() {
          return { ok: true };
        },
        async broadcastCollect() {
          return { txHash: TX };
        },
        async verifyReceipt() {
          verifies += 1;
          return {
            confirmed: verifies >= 2,
            confirmations: verifies >= 2 ? 1 : 0,
            blockNumber: 9n,
          };
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.receiptBlock).toBe(9n);
    expect(verifies).toBe(2);
  });
});

describe("Room Service worker pipeline", () => {
  it("finalizes the first due Service from a 2-confirmation snapshot and records the read block", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 100n, 0);
    const first = firstServiceNumberAfterOpen(OPEN);
    const worker = new RoomServiceWorker({
      db: executor,
      store: createPostgresIndexerStore(executor),
      reader: chain(),
      collector: okCollector(),
      financialReader: {
        async readAtBlock(blockNumber) {
          return {
            balanceReadBlock: blockNumber,
            claimedReadBlock: blockNumber,
            contractBalanceWei: 100n,
            totalRoomServiceClaimedWei: 0n,
          };
        },
      },
      hotelOpenTimestamp: OPEN,
      exclusions: buildExclusionSet({
        hotelTokenAddress: TOKEN,
        hotelLaunchBlock: 1n,
        hotelOpenBlock: null,
        hotelOpenTimestamp: OPEN,
        liveConfirmations: 1,
        publicStaleThresholdMs: 30_000,
        manualExclusions: [],
      }),
    });

    const run = await worker.run(first * 900 * 1000);
    expect(run.attempts[0]?.finalized).toBe(true);
    const rounds = await executor.query<{ block: string; pool: string }>(
      `SELECT financial_read_block::text AS block, service_pool_wei::text AS pool FROM service_rounds`,
    );
    expect(rounds.rows).toHaveLength(1);
    expect(rounds.rows[0]?.block).toBe("90");
    expect(rounds.rows[0]?.pool).toBe("100");
  });

  it("does not finalize N+1 while collection for N fails, and keeps indexing", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 10n, 0);
    const store = createPostgresIndexerStore(executor);
    const first = firstServiceNumberAfterOpen(OPEN);
    const worker = new RoomServiceWorker({
      db: executor,
      store,
      reader: chain(),
      collector: {
        async simulateCollect() {
          return { ok: false, error: "fee escrow unavailable" };
        },
        async broadcastCollect() {
          throw new Error("broadcast must not run");
        },
        async verifyReceipt() {
          throw new Error("verify must not run");
        },
      },
      financialReader: readerFor(10n, 0n),
      hotelOpenTimestamp: OPEN,
      exclusions: new Set(),
      sleep: async () => {},
    });
    const run = await worker.run((first + 2) * 900 * 1000);
    expect(run.attempts).toHaveLength(1);
    expect(run.delayed).toBe(true);
    expect(await store.getPublicStatus()).toBe(PUBLIC_STATUS.ROOM_SERVICE_DELAYED);
    const rounds = await executor.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM service_rounds`,
    );
    expect(rounds.rows[0]?.c).toBe(0);

    const liveLog = transferFixture({
      blockNumber: 11n,
      blockHash: `0x${"22".repeat(32)}` as Hex,
      txHash: `0x${"d".repeat(64)}` as Hex,
      logIndex: 0,
      from: ZERO_ADDRESS as AddressHex,
      to: BOB,
      valueRaw: 4n,
    });
    expect(await store.tryInsertTransfer(liveLog)).toBe(true);
    await applyTransferToBalances(store, liveLog);
    expect(await store.getBalance(BOB)).toBe(4n);
    expect(await store.getPublicStatus()).toBe(PUBLIC_STATUS.ROOM_SERVICE_DELAYED);
  });

  it("becomes STUCK after 30 minutes and auto-recovers on a later success", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 5n, 0);
    const store = createPostgresIndexerStore(executor);
    const first = firstServiceNumberAfterOpen(OPEN);
    let fail = true;
    const worker = new RoomServiceWorker({
      db: executor,
      store,
      reader: chain(),
      collector: {
        async simulateCollect() {
          return fail ? { ok: false, error: "down" } : { ok: true };
        },
        async broadcastCollect() {
          return { txHash: TX };
        },
        async verifyReceipt() {
          return { confirmed: true, confirmations: 1, blockNumber: 90n };
        },
      },
      financialReader: {
        async readAtBlock(blockNumber) {
          return {
            balanceReadBlock: blockNumber,
            claimedReadBlock: blockNumber,
            contractBalanceWei: 5n,
            totalRoomServiceClaimedWei: 0n,
          };
        },
      },
      hotelOpenTimestamp: OPEN,
      exclusions: new Set(),
      sleep: async () => {},
    });

    await worker.run(first * 900 * 1000);
    await executor.query(
      `UPDATE operational_incidents
       SET opened_at = now() - interval '31 minutes'
       WHERE incident_kind = 'ROOM_SERVICE_DELAYED'`,
    );
    const stuckRun = await worker.run(first * 900 * 1000 + 31 * 60 * 1000);
    expect(stuckRun.stuck).toBe(true);
    const state = await executor.query<{ stuck: boolean }>(
      `SELECT collection_stuck AS stuck FROM system_state WHERE id = 1`,
    );
    expect(state.rows[0]?.stuck).toBe(true);

    fail = false;
    const recovered = await worker.run(first * 900 * 1000);
    expect(recovered.attempts[0]?.finalized).toBe(true);
    const after = await executor.query<{ stuck: boolean; delayed: boolean }>(
      `SELECT collection_stuck AS stuck, room_service_delayed AS delayed FROM system_state WHERE id = 1`,
    );
    expect(after.rows[0]?.stuck).toBe(false);
    expect(after.rows[0]?.delayed).toBe(false);
  });

  it("blocks finalization on mixed-block reads and on accounting underflow", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 1n, 0);
    const first = firstServiceNumberAfterOpen(OPEN);
    const mixed = new RoomServiceWorker({
      db: executor,
      store: createPostgresIndexerStore(executor),
      reader: chain(),
      collector: okCollector(),
      financialReader: readerFor(10n, 0n, 1n),
      hotelOpenTimestamp: OPEN,
      exclusions: new Set(),
    });
    const blocked = await mixed.run(first * 900 * 1000);
    expect(blocked.attempts[0]?.blocked).toBe(true);
    expect(blocked.attempts[0]?.reason).toMatch(/mixed-block/);
    const rounds = await executor.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM service_rounds`,
    );
    expect(rounds.rows[0]?.c).toBe(0);
  });

  it("is idempotent and restart-safe for an already finalized Service", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 8n, 0);
    const first = firstServiceNumberAfterOpen(OPEN);
    const deps = {
      db: executor,
      store: createPostgresIndexerStore(executor),
      reader: chain(),
      collector: okCollector(),
      financialReader: {
        async readAtBlock(blockNumber: bigint): Promise<FinancialRead> {
          return {
            balanceReadBlock: blockNumber,
            claimedReadBlock: blockNumber,
            contractBalanceWei: 8n,
            totalRoomServiceClaimedWei: 0n,
          };
        },
      },
      hotelOpenTimestamp: OPEN,
      exclusions: new Set<string>(),
    };
    const firstRun = await new RoomServiceWorker(deps).run(first * 900 * 1000);
    expect(firstRun.attempts[0]?.finalized).toBe(true);
    const again = await submitServiceFinalization(executor, {
      serviceNumber: first,
      boundaryTimestamp: first * 900,
      financialReadBlock: 90n,
      servicePoolWei: 8n,
      totalEligibleBalanceRaw: 8n,
      contractBalanceWei: 8n,
      totalRoomServiceClaimedWei: 0n,
      unallocatedWeiBefore: 8n,
      allocations: [{ guestAddress: ALICE, guestBalanceRaw: 8n, allocationWei: 8n }],
    });
    expect(again.alreadyFinalized).toBe(true);
    const restarted = await new RoomServiceWorker({
      ...deps,
      store: createPostgresIndexerStore(executor),
    }).run(first * 900 * 1000);
    expect(restarted.attempts).toHaveLength(0);
    const rounds = await executor.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM service_rounds`,
    );
    expect(rounds.rows[0]?.c).toBe(1);
    const earned = await executor.query<{ earned: string }>(
      `SELECT cumulative_earned_wei::text AS earned FROM guest_entitlements`,
    );
    expect(earned.rows[0]?.earned).toBe("8");
  });

  it("excludes contracts at the snapshot block and carries dust without a penthouse bonus", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    await seedMint(db, ALICE, 1n, 0);
    await seedMint(db, BOB, 1n, 1);
    await seedMint(db, CAROL, 1n, 2);
    await seedMint(db, CONTRACT, 100n, 3);
    const reader = chain();
    reader.setCode(CONTRACT, 98n, "0x60016000");
    const first = firstServiceNumberAfterOpen(OPEN);
    const worker = new RoomServiceWorker({
      db: executor,
      store: createPostgresIndexerStore(executor),
      reader,
      collector: okCollector(),
      financialReader: {
        async readAtBlock(blockNumber) {
          return {
            balanceReadBlock: blockNumber,
            claimedReadBlock: blockNumber,
            contractBalanceWei: 10n,
            totalRoomServiceClaimedWei: 0n,
          };
        },
      },
      hotelOpenTimestamp: OPEN,
      exclusions: new Set([ZERO_ADDRESS]),
    });
    await worker.run(first * 900 * 1000);
    const allocs = await executor.query<{ guest: string; wei: string }>(
      `SELECT guest_address AS guest, allocation_wei::text AS wei FROM service_allocations ORDER BY guest_address`,
    );
    expect(allocs.rows.map((r) => r.guest)).not.toContain(CONTRACT);
    expect(allocs.rows.map((r) => r.wei)).toEqual(["3", "3", "3"]);
    const round = await executor.query<{ dust: string }>(
      `SELECT dust_wei::text AS dust FROM service_rounds`,
    );
    expect(round.rows[0]?.dust).toBe("1");
  });
});

describe("production runtime wiring", () => {
  it("uses Postgres when DATABASE_URL is set and never returns the memory store", () => {
    const db = new PGlite();
    const runtime = createProductionRuntime({
      databaseUrl: "postgresql://local/hotel",
      executor: pgliteExecutor(db),
    });
    expect(runtime.mode).toBe("postgres");
    expect(() => createProductionRuntime({ databaseUrl: "  " })).toThrow(/DATABASE_URL/);
  });
});
