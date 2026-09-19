import type { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import {
  escrowCoherentWithRoomServiceBalance,
  holdersWithEffectiveEscrowBalance,
  normalizeAddress,
  rankEligibleHolders,
} from "@hotel100/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "../indexer/sql.js";
import type { Hex } from "../rpc/types.js";
import { assertEscrowCoherence, ingestCheckInEvent, loadUnwithdrawnEscrows } from "./store.js";

const GUEST = normalizeAddress("0x0000000000000000000000000000000000000001");
const ROOM = normalizeAddress("0x00000000000000000000000000000000000000c0");
const TX1 = `0x${"11".repeat(32)}` as Hex;
const TX2 = `0x${"22".repeat(32)}` as Hex;
const BH = `0x${"bb".repeat(32)}` as Hex;

function asSql(db: PGlite): SqlExecutor {
  return {
    query: (sql, params) => db.query(sql, params),
  };
}

let db: PGlite;

beforeEach(async () => {
  db = await applyHotelMigrations();
});

afterEach(async () => {
  await db.close();
});

describe("check-in escrow ingest + coherence", () => {
  it("persists CheckedIn idempotently and attributes escrow to guest for ranking", async () => {
    const sql = asSql(db);
    const first = await ingestCheckInEvent(sql, {
      kind: "CheckedIn",
      txHash: TX1,
      logIndex: 1,
      blockNumber: 10n,
      blockHash: BH,
      guest: GUEST,
      amount: 40n,
      checkInTimestamp: 1_000,
      unlockTimestamp: 4_600,
      nonce: 1n,
      eligibilitySignerEpoch: 1n,
    });
    const second = await ingestCheckInEvent(sql, {
      kind: "CheckedIn",
      txHash: TX1,
      logIndex: 1,
      blockNumber: 10n,
      blockHash: BH,
      guest: GUEST,
      amount: 40n,
      checkInTimestamp: 1_000,
      unlockTimestamp: 4_600,
      nonce: 1n,
      eligibilitySignerEpoch: 1n,
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);

    const escrows = await loadUnwithdrawnEscrows(sql);
    expect(escrows).toHaveLength(1);
    expect(escrows[0]?.amountRaw).toBe(40n);

    const ranked = rankEligibleHolders(
      holdersWithEffectiveEscrowBalance({
        walletHolders: [
          { address: GUEST, balanceRaw: 60n },
          { address: ROOM, balanceRaw: 40n },
        ],
        escrows: escrows.map((e) => ({
          guestAddress: e.guestAddress,
          amountRaw: e.amountRaw,
          checkInTimestamp: e.checkInTimestamp,
          unlockTimestamp: e.unlockTimestamp,
        })),
        excludedAddresses: new Set([ROOM]),
      }),
    );
    expect(ranked[0]?.address).toBe(GUEST);
    expect(ranked[0]?.balanceRaw).toBe(100n);
    expect(ranked.some((h) => h.address === ROOM)).toBe(false);
  });

  it("fails closed when unwithdrawn escrow exceeds RoomService balance", async () => {
    const sql = asSql(db);
    await ingestCheckInEvent(sql, {
      kind: "CheckedIn",
      txHash: TX1,
      logIndex: 0,
      blockNumber: 5n,
      blockHash: BH,
      guest: GUEST,
      amount: 100n,
      checkInTimestamp: 1,
      unlockTimestamp: 3601,
      nonce: 2n,
      eligibilitySignerEpoch: 1n,
    });
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
      ROOM,
      "50",
    ]);
    expect(
      escrowCoherentWithRoomServiceBalance({
        unwithdrawnEscrowTotal: 100n,
        roomServiceBalanceRaw: 50n,
      }),
    ).toBe(false);
    const coherence = await assertEscrowCoherence(sql, ROOM);
    expect(coherence.ok).toBe(false);
  });

  it("closes position on CheckedOut and keeps historical row", async () => {
    const sql = asSql(db);
    await ingestCheckInEvent(sql, {
      kind: "CheckedIn",
      txHash: TX1,
      logIndex: 0,
      blockNumber: 5n,
      blockHash: BH,
      guest: GUEST,
      amount: 25n,
      checkInTimestamp: 10,
      unlockTimestamp: 3610,
      nonce: 3n,
      eligibilitySignerEpoch: 1n,
    });
    await ingestCheckInEvent(sql, {
      kind: "CheckedOut",
      txHash: TX2,
      logIndex: 2,
      blockNumber: 20n,
      blockHash: BH,
      guest: GUEST,
      amount: 25n,
      checkOutTimestamp: 4000,
    });
    const open = await loadUnwithdrawnEscrows(sql);
    expect(open).toHaveLength(0);
    const { rows } = await db.query<{ withdrawn_at: string | null }>(
      `SELECT withdrawn_at FROM check_in_positions WHERE guest_address = $1`,
      [GUEST],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.withdrawn_at).not.toBeNull();
  });
});
