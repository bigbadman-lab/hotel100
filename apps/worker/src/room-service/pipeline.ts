import {
  COLLECTION_STUCK_AFTER_MS,
  holdersWithEffectiveEscrowBalance,
  OPERATIONAL_STATUS,
  PUBLIC_STATUS,
  rankEligibleHolders,
  rewardWeight,
  stayBoostPhase,
} from "@hotel100/domain";
import { loadEscrowsOpenAtBlock, toDomainEscrows } from "../check-in/index.js";
import { reconstructBalancesFromTransfers } from "../indexer/balances.js";
import { filterEligibleHolders } from "../indexer/eligibility.js";
import type { SqlExecutor } from "../indexer/sql.js";
import type { IndexerStore } from "../indexer/types.js";
import type { ChainReader } from "../rpc/types.js";
import { allocateServicePool } from "./allocate.js";
import { collectRoomServiceFees, type FeeCollector, writeWorkerAudit } from "./collection.js";
import {
  lastFinalizedServiceNumber,
  submitServiceFinalization,
  totalFinalizedEarnedWei,
} from "./finalize.js";
import { computeUnallocated, type RoomServiceFinancialReader } from "./financial.js";
import { dueServiceNumbers, serviceBoundary } from "./schedule.js";
import { selectFinancialSnapshotBlock } from "./snapshot.js";

export type RoomServiceWorkerDeps = {
  db: SqlExecutor;
  store: IndexerStore;
  reader: ChainReader;
  collector: FeeCollector;
  financialReader: RoomServiceFinancialReader;
  hotelOpenTimestamp: number | null;
  exclusions: Set<string>;
  /** RoomService address — excluded from ranking; escrow attribution source. */
  roomServiceAddress?: string;
  sleep?: (ms: number) => Promise<void>;
};

export type ServiceAttemptResult = {
  serviceNumber: number;
  finalized: boolean;
  delayed: boolean;
  stuck: boolean;
  blocked: boolean;
  reason?: string;
};

export class RoomServiceWorker {
  constructor(private readonly deps: RoomServiceWorkerDeps) {}

  async run(nowMs: number): Promise<{
    attempts: ServiceAttemptResult[];
    delayed: boolean;
    stuck: boolean;
  }> {
    if (this.deps.hotelOpenTimestamp === null) {
      return { attempts: [], delayed: false, stuck: false };
    }

    const last = await lastFinalizedServiceNumber(this.deps.db);
    const due = dueServiceNumbers({
      hotelOpenTimestamp: this.deps.hotelOpenTimestamp,
      nowUnixSeconds: Math.floor(nowMs / 1000),
      lastFinalizedServiceNumber: last,
    });

    const attempts: ServiceAttemptResult[] = [];
    let delayed = false;
    let stuck = false;
    for (const serviceNumber of due) {
      const result = await this.finalizeOne(serviceNumber, nowMs);
      attempts.push(result);
      delayed = delayed || result.delayed;
      stuck = stuck || result.stuck;
      if (!result.finalized) break;
    }
    return { attempts, delayed, stuck };
  }

  private async finalizeOne(serviceNumber: number, nowMs: number): Promise<ServiceAttemptResult> {
    const boundary = serviceBoundary(serviceNumber);
    const snapshotBlock = await selectFinancialSnapshotBlock({
      reader: this.deps.reader,
      boundaryTimestamp: boundary,
    });
    if (snapshotBlock === null) {
      return {
        serviceNumber,
        finalized: false,
        delayed: false,
        stuck: false,
        blocked: true,
        reason: "no 2-confirmation snapshot at or before boundary",
      };
    }

    const collection = await collectRoomServiceFees({
      collector: this.deps.collector,
      sleep: this.deps.sleep,
      db: this.deps.db,
      serviceNumber,
    });

    if (!collection.ok) {
      const stuck = await this.markDelayed(nowMs);
      return {
        serviceNumber,
        finalized: false,
        delayed: true,
        stuck,
        blocked: false,
        reason: collection.error,
      };
    }

    let read: Awaited<ReturnType<RoomServiceFinancialReader["readAtBlock"]>>;
    try {
      read = await this.deps.financialReader.readAtBlock(collection.receiptBlock);
      const earned = await totalFinalizedEarnedWei(this.deps.db);
      const accounting = computeUnallocated({ read, totalFinalizedEarnedWei: earned });

      const snapshotTs = await this.deps.reader.getBlockTimestamp(snapshotBlock);
      if (snapshotTs === null) {
        throw new Error("snapshot block timestamp missing");
      }

      const holdersAtSnapshot = reconstructBalancesFromTransfers(
        (await this.deps.store.getAllTransfersOrdered()).filter(
          (log) => log.blockNumber <= snapshotBlock,
        ),
      );
      const escrowRows = await loadEscrowsOpenAtBlock(this.deps.db, snapshotBlock);
      const escrows = toDomainEscrows(escrowRows);
      const escrowByGuest = new Map(escrowRows.map((row) => [row.guestAddress, row] as const));

      const withEffective = holdersWithEffectiveEscrowBalance({
        walletHolders: [...holdersAtSnapshot.entries()].map(([address, balanceRaw]) => ({
          address,
          balanceRaw,
        })),
        escrows,
        excludedAddresses: this.deps.exclusions,
      });

      const eligible = await filterEligibleHolders({
        reader: this.deps.reader,
        holders: withEffective,
        snapshotBlock,
        exclusions: this.deps.exclusions,
      });
      const ranked = rankEligibleHolders(eligible).filter((h) => h.rank <= 100);

      const guests = ranked.map((h) => {
        const walletHeld = holdersAtSnapshot.get(h.address) ?? 0n;
        const esc = escrowByGuest.get(h.address);
        const phase = stayBoostPhase({
          hasUnwithdrawnStay: Boolean(esc),
          unlockTimestamp: esc?.unlockTimestamp ?? 0,
          snapshotTimestamp: snapshotTs,
        });
        const weight = rewardWeight({
          walletHeld,
          escrowAmount: esc?.amountRaw ?? 0n,
          isActiveEscrow: phase === "active",
          isTop100: true,
        });
        return {
          address: h.address,
          balanceRaw: weight,
          rewardWeightRaw: weight,
          rank: h.rank,
        };
      });

      const allocated = allocateServicePool({
        servicePoolWei: accounting.unallocated,
        guests,
      });

      const submitted = await submitServiceFinalization(this.deps.db, {
        serviceNumber,
        boundaryTimestamp: boundary,
        financialReadBlock: accounting.financialReadBlock,
        servicePoolWei: accounting.unallocated,
        totalEligibleBalanceRaw: guests.reduce((s, g) => s + g.balanceRaw, 0n),
        contractBalanceWei: read.contractBalanceWei,
        totalRoomServiceClaimedWei: read.totalRoomServiceClaimedWei,
        unallocatedWeiBefore: accounting.unallocated,
        allocations: allocated.allocations.map((a) => ({
          guestAddress: a.address,
          guestBalanceRaw: a.balanceRaw,
          allocationWei: a.allocationWei,
        })),
      });

      await writeWorkerAudit(this.deps.db, {
        serviceNumber,
        phase: submitted.alreadyFinalized ? "skipped" : "verify_receipt",
        success: true,
        txHash: collection.txHash,
        attempt: collection.attempts.length,
        financialReadBlock: accounting.financialReadBlock,
        outcome: submitted.alreadyFinalized ? "already_finalized" : "finalized",
      });
      await this.clearDelay();
      return {
        serviceNumber,
        finalized: true,
        delayed: false,
        stuck: false,
        blocked: false,
        reason: submitted.alreadyFinalized ? "already_finalized" : undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeWorkerAudit(this.deps.db, {
        serviceNumber,
        phase: "failed",
        success: false,
        txHash: collection.txHash,
        attempt: collection.attempts.length,
        error: message,
        outcome: "BLOCKED",
      });
      return {
        serviceNumber,
        finalized: false,
        delayed: false,
        stuck: false,
        blocked: true,
        reason: message,
      };
    }
  }

  private async markDelayed(_nowMs: number): Promise<boolean> {
    await this.deps.store.setPublicStatus(PUBLIC_STATUS.ROOM_SERVICE_DELAYED);
    await this.deps.db.query(
      `UPDATE system_state
       SET public_status = $1, room_service_delayed = true, updated_at = now()
       WHERE id = 1`,
      [PUBLIC_STATUS.ROOM_SERVICE_DELAYED],
    );
    const open = await this.deps.db.query<{ opened_at: string | Date }>(
      `SELECT opened_at FROM operational_incidents
       WHERE incident_kind = 'ROOM_SERVICE_DELAYED' AND status = 'open'
       ORDER BY opened_at ASC LIMIT 1`,
    );
    if (open.rows.length === 0) {
      await this.deps.db.query(
        `INSERT INTO operational_incidents (incident_kind, status, detail)
         VALUES ('ROOM_SERVICE_DELAYED', 'open', '{}'::jsonb)`,
      );
    }
    const stuckRow = await this.deps.db.query<{ stuck: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM operational_incidents
         WHERE incident_kind = 'ROOM_SERVICE_DELAYED'
           AND status = 'open'
           AND opened_at <= now() - make_interval(secs => $1)
       ) AS stuck`,
      [COLLECTION_STUCK_AFTER_MS / 1000],
    );
    const stuck = Boolean(stuckRow.rows[0]?.stuck);
    if (stuck) {
      await this.deps.db.query(
        `UPDATE system_state
         SET operational_status = $1, collection_stuck = true, updated_at = now()
         WHERE id = 1`,
        [OPERATIONAL_STATUS.STUCK],
      );
      await this.deps.db.query(
        `INSERT INTO operational_incidents (incident_kind, status, detail)
         VALUES ('STUCK', 'open', '{"source":"room-service"}'::jsonb)`,
      );
    }
    return stuck;
  }

  private async clearDelay(): Promise<void> {
    await this.deps.db.query(
      `UPDATE operational_incidents
       SET status = 'resolved', resolved_at = now()
       WHERE status = 'open' AND incident_kind IN ('ROOM_SERVICE_DELAYED', 'STUCK')`,
    );
    await this.deps.db.query(
      `UPDATE system_state
       SET room_service_delayed = false,
           collection_stuck = false,
           operational_status = 'OK',
           public_status = $1,
           updated_at = now()
       WHERE id = 1`,
      [PUBLIC_STATUS.CHECK_IN_OPENS_SOON],
    );
    await this.deps.store.setPublicStatus(PUBLIC_STATUS.CHECK_IN_OPENS_SOON);
  }
}
