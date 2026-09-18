import { LIVE_CONFIRMATIONS, PUBLIC_STATUS } from "@hotel100/domain";
import { type ChainReader, indexableHead } from "../rpc/types.js";
import { applyTransferToBalances, reconstructBalancesFromTransfers } from "./balances.js";
import { computeLiveRanking } from "./ranking-state.js";
import { markSyncing, refreshStalePublicStatus } from "./stale.js";
import {
  buildExclusionSet,
  type HotelIndexerConfig,
  type IndexerStore,
  isPreOpen,
} from "./types.js";

export type IndexerRunResult = {
  advanced: boolean;
  fromBlock: bigint | null;
  toBlock: bigint | null;
  transfersApplied: number;
  gapDetected: boolean;
  reorgDetected: boolean;
  reconciled: boolean;
  publicStatus: string;
  rankingCount: number;
};

/**
 * Core HOTEL indexer + reconciler (Gate E).
 * No Room Service finalization, no Pons collection writes.
 */
export class HotelIndexer {
  private readonly exclusions: Set<string>;

  constructor(
    private readonly reader: ChainReader,
    private readonly store: IndexerStore,
    private readonly config: HotelIndexerConfig,
  ) {
    if (config.hotelLaunchBlock < 0n) {
      throw new Error("hotelLaunchBlock must be >= 0");
    }
    this.exclusions = buildExclusionSet(config);
  }

  getExclusions(): Set<string> {
    return this.exclusions;
  }

  /** Forced on worker restart. */
  async onRestart(nowMs: number): Promise<IndexerRunResult> {
    await this.reconcile("restart");
    return this.runOnce(nowMs, { forceReconcile: false });
  }

  async runOnce(nowMs: number, opts: { forceReconcile?: boolean } = {}): Promise<IndexerRunResult> {
    await refreshStalePublicStatus(this.store, nowMs, this.config.publicStaleThresholdMs);

    const latest = await this.reader.getLatestBlockNumber();
    const head = indexableHead(latest, this.config.liveConfirmations);
    let cursor = await this.store.getCursor();

    let reorgDetected = false;
    if (cursor.lastIndexedBlock !== null && cursor.lastBlockHash !== null) {
      const hash = await this.reader.getBlockHash(cursor.lastIndexedBlock);
      if (hash === null || hash.toLowerCase() !== cursor.lastBlockHash.toLowerCase()) {
        reorgDetected = true;
        await markSyncing(this.store, "REORG");
        await this.handleReorg(cursor.lastIndexedBlock);
        await this.reconcile("reorg");
        cursor = await this.store.getCursor();
      }
    }

    if (head < this.config.hotelLaunchBlock) {
      return this.finish(nowMs, {
        advanced: false,
        fromBlock: null,
        toBlock: null,
        transfersApplied: 0,
        gapDetected: false,
        reorgDetected,
        reconciled: false,
        rankingCount: 0,
      });
    }

    const fromBlock =
      cursor.lastIndexedBlock === null
        ? this.config.hotelLaunchBlock
        : cursor.lastIndexedBlock + 1n;

    if (fromBlock > head) {
      if (opts.forceReconcile) await this.reconcile("forced");
      const ranking = await this.liveRanking(head);
      return this.finish(nowMs, {
        advanced: false,
        fromBlock: null,
        toBlock: null,
        transfersApplied: 0,
        gapDetected: false,
        reorgDetected,
        reconciled: Boolean(opts.forceReconcile),
        rankingCount: ranking.length,
      });
    }

    const gapAt = await this.findFirstMissingBlock(fromBlock, head);
    if (gapAt !== null) {
      await markSyncing(this.store, "INDEXING_GAP");
      const backfillTo = gapAt === fromBlock ? null : gapAt - 1n;
      if (backfillTo !== null && backfillTo >= fromBlock) {
        await this.indexRange(fromBlock, backfillTo, nowMs);
      }
      await this.reconcile("gap");
      return this.finish(nowMs, {
        advanced: backfillTo !== null,
        fromBlock,
        toBlock: backfillTo,
        transfersApplied: 0,
        gapDetected: true,
        reorgDetected,
        reconciled: true,
        rankingCount: (await this.liveRanking(head)).length,
      });
    }

    const { transfersApplied } = await this.indexRange(fromBlock, head, nowMs);

    let reconciled = Boolean(opts.forceReconcile);
    if (opts.forceReconcile) {
      await this.reconcile("forced");
      reconciled = true;
    }

    const mismatch = await this.detectBalanceMismatch();
    if (mismatch) {
      await this.reconcile("mismatch");
      reconciled = true;
    }

    const ranking = await this.liveRanking(head);
    return this.finish(nowMs, {
      advanced: true,
      fromBlock,
      toBlock: head,
      transfersApplied,
      gapDetected: false,
      reorgDetected,
      reconciled,
      rankingCount: ranking.length,
    });
  }

  async syncPublicHistoryPostOpen(snapshotBlock: bigint): Promise<number> {
    if (isPreOpen(this.config, snapshotBlock)) {
      return 0;
    }
    const ranking = await this.liveRanking(snapshotBlock);
    let written = 0;
    for (const h of ranking) {
      if (h.rank > 100) continue;
      const room =
        h.assignment.kind === "penthouse" || h.assignment.kind === "room"
          ? h.assignment.room
          : null;
      await this.store.appendPublicStayEvent({
        kind: "check-in",
        guestAddress: h.address,
        fromRoom: null,
        toRoom: room,
        fromRank: null,
        toRank: h.rank,
        blockNumber: snapshotBlock,
      });
      written += 1;
    }
    return written;
  }

  async reconcile(reason: string): Promise<{ mismatch: boolean }> {
    const transfers = await this.store.getAllTransfersOrdered();
    const rebuilt = reconstructBalancesFromTransfers(transfers);
    const holders = await this.store.getAllHolders();
    const current = new Map(holders.map((h) => [h.address, h.balanceRaw] as const));

    let mismatch = false;
    if (rebuilt.size !== current.size) mismatch = true;
    for (const [addr, bal] of rebuilt) {
      if ((current.get(addr) ?? 0n) !== bal) {
        mismatch = true;
        break;
      }
    }
    if (!mismatch) {
      for (const [addr, bal] of current) {
        if ((rebuilt.get(addr) ?? 0n) !== bal) {
          mismatch = true;
          break;
        }
      }
    }

    if (mismatch) {
      await this.store.recordIncident(`MISMATCH:${reason}`);
      await markSyncing(this.store, "MISMATCH");
      await this.store.replaceBalances(rebuilt);
    }

    const cursor = await this.store.getCursor();
    await this.store.setCursor({
      ...cursor,
      lastReconciledBlock: cursor.lastIndexedBlock,
    });

    return { mismatch };
  }

  async liveRanking(snapshotBlock: bigint) {
    return computeLiveRanking({
      reader: this.reader,
      holders: await this.store.getAllHolders(),
      snapshotBlock,
      exclusions: this.exclusions,
    });
  }

  private async indexRange(
    fromBlock: bigint,
    toBlock: bigint,
    nowMs: number,
  ): Promise<{ transfersApplied: number }> {
    const logs = await this.reader.getTransferLogs({
      address: this.config.hotelTokenAddress,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      if (log.blockNumber < fromBlock || log.blockNumber > toBlock) {
        await markSyncing(this.store, "INDEXING_GAP");
        throw new Error(
          `gap: log block ${log.blockNumber} outside requested [${fromBlock}, ${toBlock}]`,
        );
      }
    }

    const sorted = [...logs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }
      return a.logIndex - b.logIndex;
    });

    let transfersApplied = 0;
    for (const log of sorted) {
      const inserted = await this.store.tryInsertTransfer(log);
      if (!inserted) continue;
      await applyTransferToBalances(this.store, log);
      transfersApplied += 1;
      void isPreOpen(this.config, log.blockNumber);
    }

    const endHash = await this.reader.getBlockHash(toBlock);
    if (endHash === null) {
      await markSyncing(this.store, "INDEXING_GAP");
      throw new Error(`missing block hash at ${toBlock}`);
    }

    const lastLog = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const prev = await this.store.getCursor();
    await this.store.setCursor({
      lastIndexedBlock: toBlock,
      lastTxHash: lastLog?.txHash ?? prev.lastTxHash,
      lastLogIndex: lastLog?.logIndex ?? prev.lastLogIndex,
      lastBlockHash: endHash,
      lastIndexedAtMs: nowMs,
      lastReconciledBlock: prev.lastReconciledBlock,
    });

    if ((await this.store.getPublicStatus()) !== PUBLIC_STATUS.SYNCING) {
      await this.store.setPublicStatus(PUBLIC_STATUS.CHECK_IN_OPENS_SOON);
    }

    return { transfersApplied };
  }

  private async findFirstMissingBlock(fromBlock: bigint, toBlock: bigint): Promise<bigint | null> {
    for (let b = fromBlock; b <= toBlock; b++) {
      const hash = await this.reader.getBlockHash(b);
      if (hash === null) return b;
    }
    return null;
  }

  private async detectBalanceMismatch(): Promise<boolean> {
    const rebuilt = reconstructBalancesFromTransfers(await this.store.getAllTransfersOrdered());
    const current = await this.store.getAllHolders();
    if (rebuilt.size !== current.length) return true;
    for (const h of current) {
      if ((rebuilt.get(h.address) ?? 0n) !== h.balanceRaw) return true;
    }
    return false;
  }

  private async handleReorg(fromBlockInclusive: bigint): Promise<void> {
    const all = await this.store.getAllTransfersOrdered();
    const kept = all.filter((t) => t.blockNumber < fromBlockInclusive);
    const rebuilt = reconstructBalancesFromTransfers(kept);
    await this.store.replaceBalances(rebuilt);
    await this.store.deleteTransfersAtOrAfter(fromBlockInclusive);

    const prev = fromBlockInclusive === 0n ? null : fromBlockInclusive - 1n;
    const prevHash = prev === null ? null : await this.reader.getBlockHash(prev);
    const cur = await this.store.getCursor();
    await this.store.setCursor({
      lastIndexedBlock: prev,
      lastTxHash: null,
      lastLogIndex: null,
      lastBlockHash: prevHash,
      lastReconciledBlock: prev,
      lastIndexedAtMs: cur.lastIndexedAtMs,
    });
  }

  private async finish(
    nowMs: number,
    partial: Omit<IndexerRunResult, "publicStatus">,
  ): Promise<IndexerRunResult> {
    const prior = await this.store.getPublicStatus();
    if (prior !== PUBLIC_STATUS.ROOM_SERVICE_DELAYED) {
      await refreshStalePublicStatus(this.store, nowMs, this.config.publicStaleThresholdMs);
    }
    const status = await this.store.getPublicStatus();
    if (
      status !== PUBLIC_STATUS.SYNCING &&
      status !== PUBLIC_STATUS.ROOM_SERVICE_DELAYED &&
      partial.gapDetected === false
    ) {
      await this.store.setPublicStatus(PUBLIC_STATUS.CHECK_IN_OPENS_SOON);
    }
    return {
      ...partial,
      publicStatus: await this.store.getPublicStatus(),
    };
  }
}

export { indexableHead, LIVE_CONFIRMATIONS };
