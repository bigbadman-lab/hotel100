import { PUBLIC_STALE_THRESHOLD_MS, PUBLIC_STATUS, ZERO_ADDRESS } from "@hotel100/domain";
import { describe, expect, it } from "vitest";
import {
  applyTransferToBalances,
  createMemoryIndexerStore,
  HotelIndexer,
  indexableHead,
  isEligibleEoaAtSnapshot,
} from "./indexer/index.js";
import type { HotelIndexerConfig } from "./indexer/types.js";
import { MockChainReader, transferFixture } from "./rpc/mock-reader.js";
import type { AddressHex, Hex } from "./rpc/types.js";

const HOTEL_TOKEN = "0x0000000000000000000000000000000000001000" as AddressHex;
const ALICE = "0x0000000000000000000000000000000000000001" as AddressHex;
const BOB = "0x0000000000000000000000000000000000000002" as AddressHex;
const CAROL = "0x0000000000000000000000000000000000000003" as AddressHex;
const CONTRACT = "0x00000000000000000000000000000000000000c0" as AddressHex;
const ROOM_SERVICE = "0x0000000000000000000000000000000000000a01" as AddressHex;
const HOODLOCK = "0x0000000000000000000000000000000000000a02" as AddressHex;
const MANUAL = "0x0000000000000000000000000000000000000a03" as AddressHex;
const LAUNCH = 1000n;
const OPEN = 2000n;

function cfg(overrides: Partial<HotelIndexerConfig> = {}): HotelIndexerConfig {
  return {
    hotelTokenAddress: HOTEL_TOKEN,
    hotelLaunchBlock: LAUNCH,
    hotelOpenBlock: null,
    hotelOpenTimestamp: null,
    liveConfirmations: 1,
    publicStaleThresholdMs: PUBLIC_STALE_THRESHOLD_MS,
    manualExclusions: [],
    ...overrides,
  };
}

function hash(n: bigint): Hex {
  return `0x${n.toString(16).padStart(64, "0")}` as Hex;
}

function tx(n: number): Hex {
  return `0x${n.toString(16).padStart(64, "a")}` as Hex;
}

describe("Gate E confirmation policy", () => {
  it("uses 1-confirmation indexable head (never tip / never mempool)", () => {
    expect(indexableHead(100n, 1)).toBe(99n);
    expect(indexableHead(0n, 1)).toBe(0n);
  });
});

describe("Gate E transfer application", () => {
  it("applies mint / transfer / burn in raw integer units", async () => {
    const store = createMemoryIndexerStore();
    await applyTransferToBalances(
      store,
      transferFixture({
        blockNumber: 1n,
        blockHash: hash(1n),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 100n,
      }),
    );
    expect(await store.getBalance(ALICE)).toBe(100n);

    await applyTransferToBalances(
      store,
      transferFixture({
        blockNumber: 2n,
        blockHash: hash(2n),
        txHash: tx(2),
        logIndex: 0,
        from: ALICE,
        to: BOB,
        valueRaw: 40n,
      }),
    );
    expect(await store.getBalance(ALICE)).toBe(60n);
    expect(await store.getBalance(BOB)).toBe(40n);

    await applyTransferToBalances(
      store,
      transferFixture({
        blockNumber: 3n,
        blockHash: hash(3n),
        txHash: tx(3),
        logIndex: 0,
        from: BOB,
        to: ZERO_ADDRESS as AddressHex,
        valueRaw: 10n,
      }),
    );
    expect(await store.getBalance(BOB)).toBe(30n);
  });
});

describe("Gate E HotelIndexer", () => {
  it("starts indexing at exact HOTEL_LAUNCH_BLOCK", async () => {
    const reader = new MockChainReader(LAUNCH + 5n);
    reader.setBlocks(LAUNCH, LAUNCH + 5n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH - 1n,
        blockHash: hash(LAUNCH - 1n),
        txHash: tx(9),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 999n,
      }),
    );
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 50n,
      }),
    );

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    const result = await indexer.runOnce(1_000);

    expect(result.fromBlock).toBe(LAUNCH);
    expect(await store.getBalance(ALICE)).toBe(50n);
    expect((await store.getCursor()).lastIndexedBlock).toBe(LAUNCH + 4n);
  });

  it("persists (tx_hash, log_index) idempotently", async () => {
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 7,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 10n,
      }),
    );

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);
    expect(await store.getTransferCount()).toBe(1);
    expect(await store.getBalance(ALICE)).toBe(10n);

    reader.latest = LAUNCH + 3n;
    reader.setBlock(LAUNCH + 3n, hash(LAUNCH + 3n));
    await indexer.runOnce(2_000);
    expect(await store.getTransferCount()).toBe(1);
    expect(await store.getBalance(ALICE)).toBe(10n);
  });

  it("is restart-safe via reconcile + reconstruct", async () => {
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
        valueRaw: 25n,
      }),
    );
    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);

    await store.setBalance(ALICE, 1n);
    await indexer.onRestart(2_000);
    expect(await store.getBalance(ALICE)).toBe(25n);
    expect((await store.getCursor()).lastReconciledBlock).toBe(
      (await store.getCursor()).lastIndexedBlock,
    );
  });

  it("never indexes the unconfirmed tip (1 confirmation)", async () => {
    const reader = new MockChainReader(LAUNCH + 1n);
    reader.setBlocks(LAUNCH, LAUNCH + 1n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH + 1n,
        blockHash: hash(LAUNCH + 1n),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 1n,
      }),
    );
    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);
    expect(await store.getBalance(ALICE)).toBe(0n);
    expect((await store.getCursor()).lastIndexedBlock).toBe(LAUNCH);
  });

  it("detects gap, sets HOTEL SYNCING, does not advance past hole, then backfills", async () => {
    const reader = new MockChainReader(LAUNCH + 5n);
    reader.setBlocks(LAUNCH, LAUNCH + 5n);
    reader.removeBlock(LAUNCH + 2n);

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    const result = await indexer.runOnce(1_000);

    expect(result.gapDetected).toBe(true);
    expect(await store.getPublicStatus()).toBe(PUBLIC_STATUS.SYNCING);
    const last = (await store.getCursor()).lastIndexedBlock;
    expect(last === null || last < LAUNCH + 2n).toBe(true);

    reader.setBlock(LAUNCH + 2n, hash(LAUNCH + 2n));
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH + 2n,
        blockHash: hash(LAUNCH + 2n),
        txHash: tx(2),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: BOB,
        valueRaw: 7n,
      }),
    );
    const resume = await indexer.runOnce(2_000);
    expect(resume.gapDetected).toBe(false);
    expect(await store.getBalance(BOB)).toBe(7n);
    expect((await store.getCursor()).lastIndexedBlock).toBe(LAUNCH + 4n);
  });

  it("force-reconciles on mismatch", async () => {
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
        valueRaw: 11n,
      }),
    );
    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);
    await store.setBalance(ALICE, 0n);
    const result = await indexer.runOnce(2_000, { forceReconcile: true });
    expect(result.reconciled).toBe(true);
    expect(await store.getBalance(ALICE)).toBe(11n);
  });

  it("silently corrects balances on reorg", async () => {
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
        valueRaw: 5n,
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
        valueRaw: 8n,
      }),
    );

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);
    expect(await store.getBalance(BOB)).toBe(8n);

    const newHash = `0x${"b".repeat(64)}` as Hex;
    reader.setBlock(LAUNCH + 1n, newHash);
    reader.transfersByBlock.delete((LAUNCH + 1n).toString());
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH + 1n,
        blockHash: newHash,
        txHash: tx(3),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: CAROL,
        valueRaw: 3n,
      }),
    );

    const cur = await store.getCursor();
    await store.setCursor({
      ...cur,
      lastIndexedBlock: LAUNCH + 1n,
      lastBlockHash: hash(LAUNCH + 1n),
    });

    const result = await indexer.runOnce(3_000);
    expect(result.reorgDetected).toBe(true);
    expect(await store.getBalance(BOB)).toBe(0n);
    expect(await store.getBalance(CAROL)).toBe(3n);
  });

  it("exposes HOTEL SYNCING when indexed state is >30 seconds stale", async () => {
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);

    await indexer.runOnce(1_000 + PUBLIC_STALE_THRESHOLD_MS + 1);
    expect(await store.getPublicStatus()).toBe(PUBLIC_STATUS.SYNCING);
  });

  it("evaluates EOA eligibility at snapshot block via eth_getCode", async () => {
    const reader = new MockChainReader(LAUNCH);
    reader.setCode(CONTRACT, 50n, "0x6001600055");
    reader.setCode(ALICE, 50n, "0x");

    expect(
      await isEligibleEoaAtSnapshot({
        reader,
        address: ALICE,
        snapshotBlock: 50n,
        exclusions: new Set(),
      }),
    ).toBe(true);

    expect(
      await isEligibleEoaAtSnapshot({
        reader,
        address: CONTRACT,
        snapshotBlock: 50n,
        exclusions: new Set(),
      }),
    ).toBe(false);
  });

  it("excludes contracts, zero/burn, manual, and configured protocol addresses", async () => {
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    for (const [to, value] of [
      [ALICE, 100n],
      [CONTRACT, 100n],
      [ROOM_SERVICE, 100n],
      [HOODLOCK, 100n],
      [MANUAL, 100n],
      [ZERO_ADDRESS, 0n],
    ] as const) {
      if (value === 0n) continue;
      reader.addTransfer(
        transferFixture({
          blockNumber: LAUNCH,
          blockHash: hash(LAUNCH),
          txHash: tx(Number(value) + to.charCodeAt(40)),
          logIndex: Number(value),
          from: ZERO_ADDRESS as AddressHex,
          to: to as AddressHex,
          valueRaw: value,
        }),
      );
    }
    reader.setCode(CONTRACT, LAUNCH + 1n, "0xdeadbeef");

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(
      reader,
      store,
      cfg({
        roomServiceAddress: ROOM_SERVICE,
        hoodLockAddress: HOODLOCK,
        manualExclusions: [MANUAL],
      }),
    );
    await indexer.runOnce(1_000);

    const ranking = await indexer.liveRanking(LAUNCH + 1n);
    const addrs = ranking.map((r) => r.address);
    expect(addrs).toContain(ALICE);
    expect(addrs).not.toContain(CONTRACT);
    expect(addrs).not.toContain(ROOM_SERVICE);
    expect(addrs).not.toContain(HOODLOCK);
    expect(addrs).not.toContain(MANUAL);
    expect(addrs).not.toContain(ZERO_ADDRESS);
  });

  it("reconstructs pre-open balances without public stay/history", async () => {
    const reader = new MockChainReader(LAUNCH + 5n);
    reader.setBlocks(LAUNCH, LAUNCH + 5n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 42n,
      }),
    );
    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(
      reader,
      store,
      cfg({ hotelOpenBlock: OPEN, hotelOpenTimestamp: 1_700_000_000 }),
    );
    await indexer.runOnce(1_000);

    expect(await store.getBalance(ALICE)).toBe(42n);
    expect(await store.getPublicStayEvents()).toHaveLength(0);

    const written = await indexer.syncPublicHistoryPostOpen(LAUNCH + 1n);
    expect(written).toBe(0);
    expect(await store.getPublicStayEvents()).toHaveLength(0);
  });

  it("allows public history sync only at/after HOTEL_OPEN_BLOCK", async () => {
    const reader = new MockChainReader(OPEN + 2n);
    reader.setBlocks(LAUNCH, OPEN + 2n);
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 10n,
      }),
    );
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(2),
        logIndex: 1,
        from: ZERO_ADDRESS as AddressHex,
        to: BOB,
        valueRaw: 5n,
      }),
    );

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(
      reader,
      store,
      cfg({ hotelOpenBlock: OPEN, hotelOpenTimestamp: 1_700_000_000 }),
    );
    await indexer.runOnce(1_000);
    expect(await store.getPublicStayEvents()).toHaveLength(0);

    const written = await indexer.syncPublicHistoryPostOpen(OPEN);
    expect(written).toBeGreaterThan(0);
    expect((await store.getPublicStayEvents()).length).toBeGreaterThan(0);
  });

  it("ranks top holders with canonical domain logic (balance DESC, address ASC)", async () => {
    const reader = new MockChainReader(LAUNCH + 2n);
    reader.setBlocks(LAUNCH, LAUNCH + 2n);
    // Equal balances — lower address wins
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(1),
        logIndex: 0,
        from: ZERO_ADDRESS as AddressHex,
        to: BOB,
        valueRaw: 100n,
      }),
    );
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(2),
        logIndex: 1,
        from: ZERO_ADDRESS as AddressHex,
        to: ALICE,
        valueRaw: 100n,
      }),
    );
    reader.addTransfer(
      transferFixture({
        blockNumber: LAUNCH,
        blockHash: hash(LAUNCH),
        txHash: tx(3),
        logIndex: 2,
        from: ZERO_ADDRESS as AddressHex,
        to: CAROL,
        valueRaw: 200n,
      }),
    );

    const store = createMemoryIndexerStore();
    const indexer = new HotelIndexer(reader, store, cfg());
    await indexer.runOnce(1_000);
    const ranking = await indexer.liveRanking(LAUNCH + 1n);

    expect(ranking[0]?.address).toBe(CAROL);
    expect(ranking[0]?.assignment.kind).toBe("penthouse");
    expect(ranking[1]?.address).toBe(ALICE);
    expect(ranking[2]?.address).toBe(BOB);
  });
});
