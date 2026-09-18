import { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import { PUBLIC_STATUS, ZERO_ADDRESS } from "@hotel100/domain";
import { describe, expect, it } from "vitest";
import { createPostgresIndexerStore, HotelIndexer, selectIndexerStore } from "./indexer/index.js";
import type { SqlExecutor } from "./indexer/sql.js";
import type { HotelIndexerConfig } from "./indexer/types.js";
import { MockChainReader, transferFixture } from "./rpc/mock-reader.js";
import type { AddressHex, Hex } from "./rpc/types.js";

const HOTEL_TOKEN = "0x0000000000000000000000000000000000001000" as AddressHex;
const ALICE = "0x0000000000000000000000000000000000000001" as AddressHex;
const BOB = "0x0000000000000000000000000000000000000002" as AddressHex;
const LAUNCH = 5000n;

function hash(n: bigint): Hex {
  return `0x${n.toString(16).padStart(64, "0")}` as Hex;
}
function tx(n: number): Hex {
  return `0x${n.toString(16).padStart(64, "b")}` as Hex;
}

function pgliteExecutor(db: PGlite): SqlExecutor {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await db.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}

function cfg(): HotelIndexerConfig {
  return {
    hotelTokenAddress: HOTEL_TOKEN,
    hotelLaunchBlock: LAUNCH,
    hotelOpenBlock: null,
    hotelOpenTimestamp: null,
    liveConfirmations: 1,
    publicStaleThresholdMs: 30_000,
    manualExclusions: [],
  };
}

describe("Gate E Postgres IndexerStore persistence", () => {
  it("persists transfers/cursor/balances across store instance destroy+recreate", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);

    const reader = new MockChainReader(LAUNCH + 3n);
    reader.setBlocks(LAUNCH, LAUNCH + 3n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 77n,
      }),
    );

    const store1 = createPostgresIndexerStore(executor);
    const indexer = new HotelIndexer(reader, store1, cfg());
    await indexer.runOnce(10_000);

    expect(await store1.getBalance(ALICE)).toBe(77n);
    const cursor1 = await store1.getCursor();
    expect(cursor1.lastIndexedBlock).toBe(LAUNCH + 2n);
    expect(cursor1.lastBlockHash).not.toBeNull();
    expect(cursor1.lastReconciledBlock).toBeNull(); // not reconciled unless forced/mismatch
    expect(await store1.getTransferCount()).toBe(1);

    // Destroy instance — new store against same DB must restore state
    const store2 = createPostgresIndexerStore(executor);
    expect(await store2.getBalance(ALICE)).toBe(77n);
    expect(await store2.getTransferCount()).toBe(1);
    const cursor2 = await store2.getCursor();
    expect(cursor2.lastIndexedBlock).toBe(cursor1.lastIndexedBlock);
    expect(cursor2.lastBlockHash).toBe(cursor1.lastBlockHash);
    expect(cursor2.lastIndexedAtMs).toBe(10_000);
  });

  it("keeps (tx_hash, log_index) idempotent after restart", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(9),
        logIndex: 3,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 5n,
      }),
    );

    const store1 = createPostgresIndexerStore(executor);
    await new HotelIndexer(reader, store1, cfg()).runOnce(1_000);
    expect(await store1.getBalance(ALICE)).toBe(5n);

    const store2 = createPostgresIndexerStore(executor);
    reader.latest = LAUNCH + 3n;
    reader.setBlock(LAUNCH + 3n, hash(LAUNCH + 3n));
    await new HotelIndexer(reader, store2, cfg()).runOnce(2_000);

    expect(await store2.getTransferCount()).toBe(1);
    expect(await store2.getBalance(ALICE)).toBe(5n);
  });

  it("persists reorg rewind across subsequent restart", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    const reader = new MockChainReader(LAUNCH + 3n);
    reader.setBlocks(LAUNCH, LAUNCH + 3n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 1n,
      }),
    );
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH + 1n,
        blockHash: hash(LAUNCH + 1n),
        txHash: tx(2),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: BOB,
        valueRaw: 9n,
      }),
    );

    const store1 = createPostgresIndexerStore(executor);
    await new HotelIndexer(reader, store1, cfg()).runOnce(1_000);
    expect(await store1.getBalance(BOB)).toBe(9n);

    const newHash = `0x${"c".repeat(64)}` as Hex;
    reader.setBlock(LAUNCH + 1n, newHash);
    reader.transfersByBlock.delete((LAUNCH + 1n).toString());
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH + 1n,
        blockHash: newHash,
        txHash: tx(3),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 4n,
      }),
    );

    const cur = await store1.getCursor();
    await store1.setCursor({
      ...cur,
      lastIndexedBlock: LAUNCH + 1n,
      lastBlockHash: hash(LAUNCH + 1n),
    });

    await new HotelIndexer(reader, store1, cfg()).runOnce(2_000);
    expect(await store1.getBalance(BOB)).toBe(0n);
    expect(await store1.getBalance(ALICE)).toBe(5n); // 1 + 4

    const store2 = createPostgresIndexerStore(executor);
    expect(await store2.getBalance(BOB)).toBe(0n);
    expect(await store2.getBalance(ALICE)).toBe(5n);
    expect(await store2.hasTransfer(tx(2), 0)).toBe(false);
    expect(await store2.hasTransfer(tx(3), 0)).toBe(true);
  });

  it("survives last_indexed_block and last_reconciled_block across restart", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 3n,
      }),
    );

    const store1 = createPostgresIndexerStore(executor);
    await new HotelIndexer(reader, store1, cfg()).runOnce(1_000, { forceReconcile: true });
    const c1 = await store1.getCursor();
    expect(c1.lastIndexedBlock).toBe(LAUNCH + 1n);
    expect(c1.lastReconciledBlock).toBe(LAUNCH + 1n);

    const store2 = createPostgresIndexerStore(executor);
    const c2 = await store2.getCursor();
    expect(c2.lastIndexedBlock).toBe(c1.lastIndexedBlock);
    expect(c2.lastReconciledBlock).toBe(c1.lastReconciledBlock);
  });

  it("does not bypass gap state via restart (cursor stays before hole)", async () => {
    const db = await applyHotelMigrations(new PGlite());
    const executor = pgliteExecutor(db);
    const reader = new MockChainReader(LAUNCH + 5n);
    reader.setBlocks(LAUNCH, LAUNCH + 5n);
    reader.removeBlock(LAUNCH + 2n);

    const store1 = createPostgresIndexerStore(executor);
    const r1 = await new HotelIndexer(reader, store1, cfg()).runOnce(1_000);
    expect(r1.gapDetected).toBe(true);
    expect(await store1.getPublicStatus()).toBe(PUBLIC_STATUS.SYNCING);
    const c1 = await store1.getCursor();
    expect(
      c1.lastIndexedBlock === null || c1.lastIndexedBlock < LAUNCH + 2n,
    ).toBe(true);

    // Restart with same gap still present — must not jump past hole
    const store2 = createPostgresIndexerStore(executor);
    const r2 = await new HotelIndexer(reader, store2, cfg()).runOnce(2_000);
    expect(r2.gapDetected).toBe(true);
    expect(await store2.getPublicStatus()).toBe(PUBLIC_STATUS.SYNCING);
    const c2 = await store2.getCursor();
    expect(
      c2.lastIndexedBlock === null || c2.lastIndexedBlock < LAUNCH + 2n,
    ).toBe(true);
  });

  it("refuses silent memory fallback when database configuration is expected", () => {
    expect(() =>
      selectIndexerStore({
        config: { databaseUrl: "postgresql://local/hotel" },
        // no executor
      }),
    ).toThrow(/refusing silent memory fallback/i);

    expect(() =>
      selectIndexerStore({
        config: { databaseUrl: undefined },
        allowMemoryForTests: false,
      }),
    ).toThrow(/No database configuration/i);

    const mem = selectIndexerStore({
      config: { databaseUrl: undefined },
      allowMemoryForTests: true,
    });
    expect(mem.mode).toBe("memory");

    const dbMode = selectIndexerStore({
      config: { databaseUrl: "postgresql://local/hotel" },
      executor: pgliteExecutor(new PGlite()),
    });
    expect(dbMode.mode).toBe("postgres");
  });
});
