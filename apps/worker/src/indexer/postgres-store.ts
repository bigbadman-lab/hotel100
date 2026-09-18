import { type Address, normalizeAddress } from "@hotel100/domain";
import type { Hex, HotelTransferLog } from "../rpc/types.js";
import type { SqlExecutor } from "./sql.js";
import type { HolderRow, IndexerCursor, IndexerStore, PublicStayEvent } from "./types.js";

function toBigint(value: string | number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(value);
}

function msFromTimestamptz(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

type EventCursorJson = {
  lastTxHash?: string | null;
  lastLogIndex?: number | null;
  lastBlockHash?: string | null;
  gapBlock?: string | null;
};

/**
 * Production Postgres/Supabase IndexerStore backed by Gate D tables.
 * Survives worker restarts when DATABASE_URL / executor is provided.
 */
export function createPostgresIndexerStore(db: SqlExecutor): IndexerStore {
  return {
    async getCursor() {
      const { rows } = await db.query<{
        last_indexed_block: string | null;
        last_reconciled_block: string | null;
        event_cursor: EventCursorJson | string;
        last_indexed_at: string | Date | null;
      }>(
        `SELECT last_indexed_block::text,
                last_reconciled_block::text,
                event_cursor,
                last_indexed_at
         FROM system_state WHERE id = 1`,
      );
      const row = rows[0];
      if (!row) {
        throw new Error("system_state singleton missing — run Gate D migrations");
      }
      const cursorJson =
        typeof row.event_cursor === "string"
          ? (JSON.parse(row.event_cursor) as EventCursorJson)
          : (row.event_cursor ?? {});

      return {
        lastIndexedBlock: toBigint(row.last_indexed_block),
        lastReconciledBlock: toBigint(row.last_reconciled_block),
        lastTxHash: (cursorJson.lastTxHash as Hex | null | undefined) ?? null,
        lastLogIndex:
          cursorJson.lastLogIndex === undefined || cursorJson.lastLogIndex === null
            ? null
            : Number(cursorJson.lastLogIndex),
        lastBlockHash: (cursorJson.lastBlockHash as Hex | null | undefined) ?? null,
        lastIndexedAtMs: msFromTimestamptz(row.last_indexed_at),
      };
    },

    async setCursor(cursor: IndexerCursor) {
      const eventCursor: EventCursorJson = {
        lastTxHash: cursor.lastTxHash,
        lastLogIndex: cursor.lastLogIndex,
        lastBlockHash: cursor.lastBlockHash,
      };
      await db.query(
        `UPDATE system_state SET
           last_indexed_block = $1::numeric,
           last_reconciled_block = $2::numeric,
           event_cursor = $3::jsonb,
           last_indexed_at = CASE
             WHEN $4::bigint IS NULL THEN NULL
             ELSE to_timestamp(($4::bigint) / 1000.0)
           END,
           updated_at = now()
         WHERE id = 1`,
        [
          cursor.lastIndexedBlock?.toString() ?? null,
          cursor.lastReconciledBlock?.toString() ?? null,
          JSON.stringify(eventCursor),
          cursor.lastIndexedAtMs,
        ],
      );
    },

    async tryInsertTransfer(log: HotelTransferLog) {
      const { rows } = await db.query<{ tx_hash: string }>(
        `INSERT INTO processed_transfer_logs
           (tx_hash, log_index, block_number, block_hash, from_address, to_address, value_raw)
         VALUES ($1, $2, $3::numeric, $4, $5, $6, $7::numeric)
         ON CONFLICT (tx_hash, log_index) DO NOTHING
         RETURNING tx_hash`,
        [
          log.txHash.toLowerCase(),
          log.logIndex,
          log.blockNumber.toString(),
          log.blockHash.toLowerCase(),
          normalizeAddress(log.from),
          normalizeAddress(log.to),
          log.valueRaw.toString(),
        ],
      );
      return rows.length > 0;
    },

    async getTransferCount() {
      const { rows } = await db.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM processed_transfer_logs`,
      );
      return Number(rows[0]?.c ?? 0);
    },

    async hasTransfer(txHash, logIndex) {
      const { rows } = await db.query<{ tx_hash: string }>(
        `SELECT tx_hash FROM processed_transfer_logs
         WHERE tx_hash = $1 AND log_index = $2`,
        [txHash.toLowerCase(), logIndex],
      );
      return rows.length > 0;
    },

    async getBalance(address) {
      const { rows } = await db.query<{ balance_raw: string }>(
        `SELECT balance_raw::text FROM holders WHERE address = $1`,
        [normalizeAddress(address)],
      );
      return toBigint(rows[0]?.balance_raw) ?? 0n;
    },

    async setBalance(address, balanceRaw) {
      const addr = normalizeAddress(address);
      if (balanceRaw < 0n) throw new Error(`negative balance for ${addr}`);
      if (balanceRaw === 0n) {
        await db.query(`DELETE FROM holders WHERE address = $1`, [addr]);
        return;
      }
      await db.query(
        `INSERT INTO holders (address, balance_raw)
         VALUES ($1, $2::numeric)
         ON CONFLICT (address) DO UPDATE
           SET balance_raw = EXCLUDED.balance_raw,
               updated_at = now()`,
        [addr, balanceRaw.toString()],
      );
    },

    async getAllHolders(): Promise<HolderRow[]> {
      const { rows } = await db.query<{ address: string; balance_raw: string }>(
        `SELECT address, balance_raw::text FROM holders WHERE balance_raw > 0`,
      );
      return rows.map((r) => ({
        address: normalizeAddress(r.address),
        balanceRaw: BigInt(r.balance_raw),
      }));
    },

    async replaceBalances(balances: Map<Address, bigint>) {
      await db.query(`DELETE FROM holders`);
      for (const [address, balanceRaw] of balances) {
        if (balanceRaw > 0n) {
          await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
            normalizeAddress(address),
            balanceRaw.toString(),
          ]);
        }
      }
    },

    async getPublicStatus() {
      const { rows } = await db.query<{ public_status: string }>(
        `SELECT public_status FROM system_state WHERE id = 1`,
      );
      return rows[0]?.public_status ?? "HOTEL CHECK-IN OPENS SOON";
    },

    async setPublicStatus(status) {
      await db.query(
        `UPDATE system_state SET public_status = $1, updated_at = now() WHERE id = 1`,
        [status],
      );
    },

    async getOperationalIncidentKinds() {
      const { rows } = await db.query<{ incident_kind: string }>(
        `SELECT incident_kind FROM operational_incidents
         WHERE status = 'open'
         ORDER BY id ASC`,
      );
      return rows.map((r) => r.incident_kind);
    },

    async recordIncident(kind) {
      // Map free-form indexer kinds onto schema CHECK values when possible.
      const incidentKind = mapIncidentKind(kind);
      await db.query(
        `INSERT INTO operational_incidents (incident_kind, status, detail)
         VALUES ($1, 'open', $2::jsonb)`,
        [incidentKind, JSON.stringify({ source: "indexer", kind })],
      );
      if (incidentKind === "INDEXING_GAP" || kind.includes("GAP")) {
        await db.query(
          `UPDATE system_state SET operational_status = 'INDEXING_GAP', updated_at = now() WHERE id = 1`,
        );
      }
    },

    async clearIncidents() {
      await db.query(
        `UPDATE operational_incidents SET status = 'resolved', resolved_at = now()
         WHERE status = 'open'`,
      );
      await db.query(
        `UPDATE system_state SET operational_status = 'OK', updated_at = now() WHERE id = 1`,
      );
    },

    async appendPublicStayEvent(event: PublicStayEvent) {
      await db.query(
        `INSERT INTO room_move_events
           (guest_address, from_room, to_room, from_rank, to_rank, move_kind, block_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7::numeric)`,
        [
          normalizeAddress(event.guestAddress),
          event.fromRoom,
          event.toRoom,
          event.fromRank,
          event.toRank,
          event.kind,
          event.blockNumber.toString(),
        ],
      );
    },

    async getPublicStayEvents(): Promise<PublicStayEvent[]> {
      const { rows } = await db.query<{
        guest_address: string;
        from_room: number | null;
        to_room: number | null;
        from_rank: number | null;
        to_rank: number | null;
        move_kind: PublicStayEvent["kind"];
        block_number: string;
      }>(
        `SELECT guest_address, from_room, to_room, from_rank, to_rank, move_kind, block_number::text
         FROM room_move_events
         ORDER BY id ASC`,
      );
      return rows.map((r) => ({
        kind: r.move_kind,
        guestAddress: normalizeAddress(r.guest_address),
        fromRoom: r.from_room,
        toRoom: r.to_room,
        fromRank: r.from_rank,
        toRank: r.to_rank,
        blockNumber: BigInt(r.block_number),
      }));
    },

    async getAllTransfersOrdered(): Promise<HotelTransferLog[]> {
      const { rows } = await db.query<{
        tx_hash: string;
        log_index: number;
        block_number: string;
        block_hash: string | null;
        from_address: string;
        to_address: string;
        value_raw: string;
      }>(
        `SELECT tx_hash, log_index, block_number::text, block_hash,
                from_address, to_address, value_raw::text
         FROM processed_transfer_logs
         ORDER BY block_number ASC, tx_hash ASC, log_index ASC`,
      );
      return rows.map((r) => ({
        txHash: r.tx_hash as Hex,
        logIndex: Number(r.log_index),
        blockNumber: BigInt(r.block_number),
        blockHash: (r.block_hash ?? `0x${"0".repeat(64)}`) as Hex,
        from: normalizeAddress(r.from_address),
        to: normalizeAddress(r.to_address),
        valueRaw: BigInt(r.value_raw),
      }));
    },

    async deleteTransfersAtOrAfter(blockNumber: bigint) {
      await db.query(`DELETE FROM processed_transfer_logs WHERE block_number >= $1::numeric`, [
        blockNumber.toString(),
      ]);
    },

    async replaceTransfers(logs: HotelTransferLog[]) {
      await db.query(`DELETE FROM processed_transfer_logs`);
      for (const log of logs) {
        await db.query(
          `INSERT INTO processed_transfer_logs
             (tx_hash, log_index, block_number, block_hash, from_address, to_address, value_raw)
           VALUES ($1, $2, $3::numeric, $4, $5, $6, $7::numeric)`,
          [
            log.txHash.toLowerCase(),
            log.logIndex,
            log.blockNumber.toString(),
            log.blockHash.toLowerCase(),
            normalizeAddress(log.from),
            normalizeAddress(log.to),
            log.valueRaw.toString(),
          ],
        );
      }
    },
  };
}

function mapIncidentKind(kind: string): string {
  if (kind.includes("GAP")) return "INDEXING_GAP";
  if (kind.includes("REORG")) return "REORG";
  if (kind.includes("MISMATCH")) return "OTHER";
  if (kind.includes("STUCK")) return "STUCK";
  if (kind.includes("DELAY")) return "ROOM_SERVICE_DELAYED";
  return "OTHER";
}
