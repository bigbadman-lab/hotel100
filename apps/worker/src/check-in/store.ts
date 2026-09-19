import {
  type Address,
  escrowCoherentWithRoomServiceBalance,
  escrowOpenAtSnapshot,
  normalizeAddress,
  type UnwithdrawnEscrow,
} from "@hotel100/domain";
import type { SqlExecutor } from "../indexer/sql.js";
import type { CheckInEventLog, UnwithdrawnEscrowRow } from "./types.js";

type EventRow = {
  tx_hash: string;
  log_index: number;
  block_number: string;
  block_hash: string;
  event_kind: "CheckedIn" | "CheckedOut";
  guest_address: string;
  amount_raw: string;
  check_in_timestamp: string | number | null;
  unlock_timestamp: string | number | null;
  checkout_timestamp: string | number | null;
  nonce: string | null;
  eligibility_signer_epoch: string | null;
};

/**
 * Persist a CheckedIn / CheckedOut log idempotently and refresh derived positions.
 * Direct HOTEL transfers to RoomService never call this — no attribution without events.
 */
export async function ingestCheckInEvent(
  db: SqlExecutor,
  event: CheckInEventLog,
): Promise<{ inserted: boolean }> {
  if (event.kind === "CheckedIn") {
    const inserted = await insertEvent(db, {
      txHash: event.txHash,
      logIndex: event.logIndex,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
      eventKind: "CheckedIn",
      guest: normalizeAddress(event.guest),
      amount: event.amount,
      checkInTimestamp: event.checkInTimestamp,
      unlockTimestamp: event.unlockTimestamp,
      checkoutTimestamp: null,
      nonce: event.nonce,
      eligibilitySignerEpoch: event.eligibilitySignerEpoch,
    });
    if (!inserted) return { inserted: false };
    await db.query(
      `INSERT INTO check_in_positions (
         guest_address, amount_raw, check_in_timestamp, unlock_timestamp,
         check_in_block, check_in_tx_hash, check_in_log_index
       ) VALUES ($1, $2::numeric, $3, $4, $5::numeric, $6, $7)
       ON CONFLICT (check_in_tx_hash, check_in_log_index) DO NOTHING`,
      [
        normalizeAddress(event.guest),
        event.amount.toString(),
        event.checkInTimestamp,
        event.unlockTimestamp,
        event.blockNumber.toString(),
        event.txHash.toLowerCase(),
        event.logIndex,
      ],
    );
    return { inserted: true };
  }

  const inserted = await insertEvent(db, {
    txHash: event.txHash,
    logIndex: event.logIndex,
    blockNumber: event.blockNumber,
    blockHash: event.blockHash,
    eventKind: "CheckedOut",
    guest: normalizeAddress(event.guest),
    amount: event.amount,
    checkInTimestamp: null,
    unlockTimestamp: null,
    checkoutTimestamp: event.checkOutTimestamp,
    nonce: null,
    eligibilitySignerEpoch: null,
  });
  if (!inserted) return { inserted: false };

  const closed = await db.query<{ id: string }>(
    `UPDATE check_in_positions
     SET checkout_block = $2::numeric,
         checkout_tx_hash = $3,
         checkout_log_index = $4,
         withdrawn_at = to_timestamp($5::bigint)
     WHERE guest_address = $1
       AND withdrawn_at IS NULL
       AND amount_raw = $6::numeric
     RETURNING id::text AS id`,
    [
      normalizeAddress(event.guest),
      event.blockNumber.toString(),
      event.txHash.toLowerCase(),
      event.logIndex,
      event.checkOutTimestamp,
      event.amount.toString(),
    ],
  );
  if (closed.rows.length !== 1) {
    throw new Error(
      `check-out coherence: no open position for ${event.guest} amount=${event.amount}`,
    );
  }
  return { inserted: true };
}

export async function deleteCheckInEventsAtOrAfter(
  db: SqlExecutor,
  blockNumber: bigint,
): Promise<void> {
  await db.query(`DELETE FROM check_in_events WHERE block_number >= $1::numeric`, [
    blockNumber.toString(),
  ]);
  await rebuildCheckInPositions(db);
}

/** Deterministic rebuild of positions from the append-only event log. */
export async function rebuildCheckInPositions(db: SqlExecutor): Promise<void> {
  await db.query(`DELETE FROM check_in_positions`);
  const { rows } = await db.query<EventRow>(
    `SELECT tx_hash, log_index, block_number::text AS block_number, block_hash,
            event_kind, guest_address, amount_raw::text AS amount_raw,
            check_in_timestamp, unlock_timestamp, checkout_timestamp,
            nonce::text AS nonce, eligibility_signer_epoch::text AS eligibility_signer_epoch
     FROM check_in_events
     ORDER BY block_number ASC, log_index ASC`,
  );

  type Open = {
    guest: Address;
    amount: bigint;
    checkInTimestamp: number;
    unlockTimestamp: number;
    checkInBlock: bigint;
    checkInTxHash: string;
    checkInLogIndex: number;
  };
  const open = new Map<string, Open>();

  for (const row of rows) {
    const guest = normalizeAddress(row.guest_address);
    const amount = BigInt(row.amount_raw);
    if (row.event_kind === "CheckedIn") {
      if (open.has(guest)) {
        throw new Error(`rebuild: double open stay for ${guest}`);
      }
      open.set(guest, {
        guest,
        amount,
        checkInTimestamp: Number(row.check_in_timestamp),
        unlockTimestamp: Number(row.unlock_timestamp),
        checkInBlock: BigInt(row.block_number),
        checkInTxHash: row.tx_hash,
        checkInLogIndex: Number(row.log_index),
      });
      continue;
    }
    const current = open.get(guest);
    if (!current || current.amount !== amount) {
      throw new Error(`rebuild: checkout without matching open stay for ${guest}`);
    }
    await db.query(
      `INSERT INTO check_in_positions (
         guest_address, amount_raw, check_in_timestamp, unlock_timestamp,
         check_in_block, checkout_block, check_in_tx_hash, check_in_log_index,
         checkout_tx_hash, checkout_log_index, withdrawn_at
       ) VALUES (
         $1, $2::numeric, $3, $4, $5::numeric, $6::numeric, $7, $8, $9, $10,
         to_timestamp($11::bigint)
       )`,
      [
        guest,
        amount.toString(),
        current.checkInTimestamp,
        current.unlockTimestamp,
        current.checkInBlock.toString(),
        row.block_number,
        current.checkInTxHash,
        current.checkInLogIndex,
        row.tx_hash,
        Number(row.log_index),
        Number(row.checkout_timestamp),
      ],
    );
    open.delete(guest);
  }

  for (const current of open.values()) {
    await db.query(
      `INSERT INTO check_in_positions (
         guest_address, amount_raw, check_in_timestamp, unlock_timestamp,
         check_in_block, check_in_tx_hash, check_in_log_index
       ) VALUES ($1, $2::numeric, $3, $4, $5::numeric, $6, $7)`,
      [
        current.guest,
        current.amount.toString(),
        current.checkInTimestamp,
        current.unlockTimestamp,
        current.checkInBlock.toString(),
        current.checkInTxHash,
        current.checkInLogIndex,
      ],
    );
  }
}

export async function loadUnwithdrawnEscrows(db: SqlExecutor): Promise<UnwithdrawnEscrowRow[]> {
  const { rows } = await db.query<{
    guest_address: string;
    amount_raw: string;
    check_in_timestamp: string | number;
    unlock_timestamp: string | number;
    check_in_block: string;
  }>(
    `SELECT guest_address, amount_raw::text AS amount_raw,
            check_in_timestamp, unlock_timestamp, check_in_block::text AS check_in_block
     FROM check_in_positions
     WHERE withdrawn_at IS NULL`,
  );
  return rows.map((row) => ({
    guestAddress: normalizeAddress(row.guest_address),
    amountRaw: BigInt(row.amount_raw),
    checkInTimestamp: Number(row.check_in_timestamp),
    unlockTimestamp: Number(row.unlock_timestamp),
    checkInBlock: BigInt(row.check_in_block),
    checkoutBlock: null,
  }));
}

/** Escrows that were still unwithdrawn at snapshotBlock (historical reconstruction). */
export async function loadEscrowsOpenAtBlock(
  db: SqlExecutor,
  snapshotBlock: bigint,
): Promise<UnwithdrawnEscrowRow[]> {
  const { rows } = await db.query<{
    guest_address: string;
    amount_raw: string;
    check_in_timestamp: string | number;
    unlock_timestamp: string | number;
    check_in_block: string;
    checkout_block: string | null;
  }>(
    `SELECT guest_address, amount_raw::text AS amount_raw,
            check_in_timestamp, unlock_timestamp,
            check_in_block::text AS check_in_block,
            checkout_block::text AS checkout_block
     FROM check_in_positions
     WHERE check_in_block <= $1::numeric
       AND (checkout_block IS NULL OR checkout_block > $1::numeric)`,
    [snapshotBlock.toString()],
  );
  return rows
    .map((row) => ({
      guestAddress: normalizeAddress(row.guest_address),
      amountRaw: BigInt(row.amount_raw),
      checkInTimestamp: Number(row.check_in_timestamp),
      unlockTimestamp: Number(row.unlock_timestamp),
      checkInBlock: BigInt(row.check_in_block),
      checkoutBlock: row.checkout_block === null ? null : BigInt(row.checkout_block),
    }))
    .filter((row) =>
      escrowOpenAtSnapshot({
        checkInBlock: row.checkInBlock,
        checkoutBlock: row.checkoutBlock,
        snapshotBlock,
      }),
    );
}

export function toDomainEscrows(rows: UnwithdrawnEscrowRow[]): UnwithdrawnEscrow[] {
  return rows.map((row) => ({
    guestAddress: row.guestAddress,
    amountRaw: row.amountRaw,
    checkInTimestamp: row.checkInTimestamp,
    unlockTimestamp: row.unlockTimestamp,
  }));
}

export async function assertEscrowCoherence(
  db: SqlExecutor,
  roomServiceAddress: Address,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [escrow, holder] = await Promise.all([
    db.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_raw), 0)::text AS total
       FROM check_in_positions
       WHERE withdrawn_at IS NULL`,
    ),
    db.query<{ balance_raw: string }>(
      `SELECT balance_raw::text AS balance_raw
       FROM holders
       WHERE address = $1`,
      [normalizeAddress(roomServiceAddress)],
    ),
  ]);
  const unwithdrawn = BigInt(escrow.rows[0]?.total ?? "0");
  const roomServiceBalance = BigInt(holder.rows[0]?.balance_raw ?? "0");
  if (
    !escrowCoherentWithRoomServiceBalance({
      unwithdrawnEscrowTotal: unwithdrawn,
      roomServiceBalanceRaw: roomServiceBalance,
    })
  ) {
    return {
      ok: false,
      reason: `escrow_incoherent: unwithdrawn=${unwithdrawn} roomService=${roomServiceBalance}`,
    };
  }
  return { ok: true };
}

async function insertEvent(
  db: SqlExecutor,
  args: {
    txHash: string;
    logIndex: number;
    blockNumber: bigint;
    blockHash: string;
    eventKind: "CheckedIn" | "CheckedOut";
    guest: Address;
    amount: bigint;
    checkInTimestamp: number | null;
    unlockTimestamp: number | null;
    checkoutTimestamp: number | null;
    nonce: bigint | null;
    eligibilitySignerEpoch: bigint | null;
  },
): Promise<boolean> {
  const result = await db.query<{ tx_hash: string }>(
    `INSERT INTO check_in_events (
       tx_hash, log_index, block_number, block_hash, event_kind, guest_address, amount_raw,
       check_in_timestamp, unlock_timestamp, checkout_timestamp, nonce, eligibility_signer_epoch
     ) VALUES (
       $1, $2, $3::numeric, $4, $5, $6, $7::numeric, $8, $9, $10, $11::numeric, $12::numeric
     )
     ON CONFLICT (tx_hash, log_index) DO NOTHING
     RETURNING tx_hash`,
    [
      args.txHash.toLowerCase(),
      args.logIndex,
      args.blockNumber.toString(),
      args.blockHash.toLowerCase(),
      args.eventKind,
      args.guest,
      args.amount.toString(),
      args.checkInTimestamp,
      args.unlockTimestamp,
      args.checkoutTimestamp,
      args.nonce === null ? null : args.nonce.toString(),
      args.eligibilitySignerEpoch === null ? null : args.eligibilitySignerEpoch.toString(),
    ],
  );
  return result.rows.length === 1;
}
