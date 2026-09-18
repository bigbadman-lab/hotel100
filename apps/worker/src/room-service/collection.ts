import { COLLECTION_CONFIRMATIONS } from "@hotel100/domain";
import type { SqlExecutor } from "../indexer/sql.js";
import type { Hex } from "../rpc/types.js";

/** Narrow collection adapter. Production Pons address/ABI stay unresolved. */
export interface FeeCollector {
  simulateCollect(): Promise<{ ok: boolean; error?: string }>;
  broadcastCollect(): Promise<{ txHash: Hex }>;
  verifyReceipt(txHash: Hex): Promise<{
    confirmed: boolean;
    confirmations: number;
    blockNumber: bigint | null;
  }>;
}

export const COLLECTION_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
export const COLLECTION_MAX_ATTEMPTS = 3;

export type CollectionAttempt = {
  attempt: number;
  simulated: boolean;
  simulationOk: boolean;
  broadcast: boolean;
  txHash: Hex | null;
  confirmations: number | null;
  error?: string;
};

export type CollectionResult =
  | {
      ok: true;
      txHash: Hex;
      receiptBlock: bigint;
      attempts: CollectionAttempt[];
    }
  | { ok: false; attempts: CollectionAttempt[]; error: string };

/**
 * simulate → broadcast → verify receipt.
 * Failed simulation never broadcasts.
 * Requires COLLECTION_CONFIRMATIONS (1) before success.
 */
export async function collectRoomServiceFees(args: {
  collector: FeeCollector;
  sleep?: (ms: number) => Promise<void>;
  db?: SqlExecutor;
  serviceNumber: number;
}): Promise<CollectionResult> {
  const sleep = args.sleep ?? (async () => {});
  const attempts: CollectionAttempt[] = [];

  for (let attempt = 1; attempt <= COLLECTION_MAX_ATTEMPTS; attempt++) {
    const record: CollectionAttempt = {
      attempt,
      simulated: false,
      simulationOk: false,
      broadcast: false,
      txHash: null,
      confirmations: null,
    };

    const sim = await args.collector.simulateCollect();
    record.simulated = true;
    record.simulationOk = sim.ok;
    await writeAudit(args.db, {
      serviceNumber: args.serviceNumber,
      phase: "simulate",
      success: sim.ok,
      error: sim.error,
      attempt,
    });

    if (!sim.ok) {
      record.error = sim.error ?? "simulation failed";
      attempts.push(record);
      await sleep(COLLECTION_RETRY_DELAYS_MS[attempt - 1] ?? 10_000);
      continue;
    }

    const broadcast = await args.collector.broadcastCollect();
    record.broadcast = true;
    record.txHash = broadcast.txHash;
    await writeAudit(args.db, {
      serviceNumber: args.serviceNumber,
      phase: "broadcast",
      success: true,
      txHash: broadcast.txHash,
      attempt,
    });

    const receipt = await args.collector.verifyReceipt(broadcast.txHash);
    record.confirmations = receipt.confirmations;
    await writeAudit(args.db, {
      serviceNumber: args.serviceNumber,
      phase: "verify_receipt",
      success: receipt.confirmed && receipt.confirmations >= COLLECTION_CONFIRMATIONS,
      txHash: broadcast.txHash,
      attempt,
    });

    if (
      receipt.confirmed &&
      receipt.confirmations >= COLLECTION_CONFIRMATIONS &&
      receipt.blockNumber !== null
    ) {
      attempts.push(record);
      return {
        ok: true,
        txHash: broadcast.txHash,
        receiptBlock: receipt.blockNumber,
        attempts,
      };
    }

    record.error = "receipt not confirmed";
    attempts.push(record);
    await sleep(COLLECTION_RETRY_DELAYS_MS[attempt - 1] ?? 10_000);
  }

  return { ok: false, attempts, error: "collection failed after max attempts" };
}

async function writeAudit(
  db: SqlExecutor | undefined,
  row: {
    serviceNumber: number;
    phase: "simulate" | "broadcast" | "verify_receipt" | "failed" | "skipped";
    success: boolean;
    txHash?: string;
    error?: string;
    attempt: number;
    financialReadBlock?: bigint;
    outcome?: string;
  },
): Promise<void> {
  if (!db) return;
  await db.query(
    `INSERT INTO worker_write_audit (write_kind, phase, success, tx_hash, block_number, error_code, detail)
     VALUES ('collectRoomService', $1, $2, $3, $4::numeric, $5, $6::jsonb)`,
    [
      row.phase,
      row.success,
      row.txHash ?? null,
      row.financialReadBlock?.toString() ?? null,
      row.error ?? null,
      JSON.stringify({
        serviceNumber: row.serviceNumber,
        attempt: row.attempt,
        outcome: row.outcome ?? null,
      }),
    ],
  );
}

export { writeAudit as writeWorkerAudit };
