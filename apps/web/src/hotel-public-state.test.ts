import type { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import {
  type Address,
  additionalNeededToBeatTarget,
  findRankHundredHolder,
  normalizeAddress,
  PUBLIC_STATUS,
  rankEligibleHolders,
  roomAssignmentForRank,
} from "@hotel100/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SqlExecutor } from "./entitlement/sql";
import { presentHeaderStatus } from "./hotel/present";
import { failClosedProductionSnapshot, fetchProductionSnapshot } from "./hotel/production-client";
import { snapshotFromPublicDto } from "./hotel/public-dto";
import { handlePublicHotelState, readCanonicalHotelState } from "./hotel/public-state";
import { FIXTURE_WALLET } from "./hotel/source";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");
const CHECKED_IN = "2026-09-01T12:00:00.000Z";

let db: PGlite;

function asSql(database: PGlite): SqlExecutor {
  return {
    query: (sql, params) => database.query(sql, params),
  };
}

function holderAddress(n: number): Address {
  return normalizeAddress(`0x${n.toString(16).padStart(40, "0")}`);
}

function balanceFor(n: number): string {
  return String((300 - n) * 1000);
}

async function seedRankedHotel(indexedAt: Date, operationalStatus = "OK"): Promise<void> {
  await db.query(
    `UPDATE system_state
        SET hotel_live = true,
            operational_status = $2,
            public_status = 'LIVE — CANARY PENDING',
            live_canary_status = 'LIVE — CANARY PENDING',
            room_service_delayed = false,
            collection_stuck = false,
            last_indexed_block = 42,
            last_indexed_at = $1
      WHERE id = 1`,
    [indexedAt.toISOString(), operationalStatus],
  );
  for (let n = 1; n <= 120; n += 1) {
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
      holderAddress(n),
      balanceFor(n),
    ]);
  }
  await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
    holderAddress(999),
    "999999999",
  ]);
  await db.query(`INSERT INTO excluded_addresses (address, reason) VALUES ($1, 'protocol')`, [
    holderAddress(999),
  ]);
  await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
    "0x000000000000000000000000000000000000dead",
    "888888888",
  ]);
  await db.query(
    `INSERT INTO guest_stays (
       guest_address, room_number, rank, checked_in_at, best_room_ever, is_active, not_checked_in
     ) VALUES ($1, 1, 1, $2, 4, true, false)`,
    [holderAddress(1), CHECKED_IN],
  );
  await db.query(
    `INSERT INTO room_history (guest_address, room_number, rank, occupied_from)
     VALUES ($1, 4, 4, $2)`,
    [holderAddress(1), CHECKED_IN],
  );
}

beforeEach(async () => {
  db = await applyHotelMigrations();
});

afterEach(async () => {
  await db.close();
});

describe("canonical public hotel state", () => {
  it("reads persisted ranking, maps rooms 1–100, and keeps the lobby threshold canonical", async () => {
    await seedRankedHotel(new Date(NOW - 1_000));
    const state = await readCanonicalHotelState(asSql(db), { nowMs: NOW, wallet: null });
    const expectedRanked = rankEligibleHolders(
      Array.from({ length: 120 }, (_, index) => ({
        address: holderAddress(index + 1),
        balanceRaw: BigInt(balanceFor(index + 1)),
      })),
    );

    expect(state.fixturePreview).toBe(false);
    expect(state.syncing).toBe(false);
    expect(state.lastIndexedBlock).toBe("42");
    expect(state.freshnessMs).toBe(1_000);
    expect(roomAssignmentForRank(1)).toEqual({ kind: "penthouse", room: 1, rank: 1 });
    expect(state.rooms[0]).toMatchObject({
      room: 1,
      rank: 1,
      address: holderAddress(1),
      balanceRaw: balanceFor(1),
      checkedInSinceMs: Date.parse(CHECKED_IN),
      bestRoomEver: 4,
    });

    for (let room = 2; room <= 100; room += 1) {
      const assignment = roomAssignmentForRank(room);
      expect(assignment.kind).toBe("room");
      if (assignment.kind !== "room") continue;
      expect(state.rooms[room - 1]).toMatchObject({
        room,
        rank: room,
        address: holderAddress(room),
        balanceRaw: balanceFor(room),
      });
    }

    expect(state.room100ThresholdRaw).toBe(
      findRankHundredHolder(expectedRanked)?.balanceRaw.toString(),
    );
    expect(state.lobby.map((guest) => guest.rank)).toEqual([
      101, 102, 103, 104, 105, 106, 107, 108,
    ]);
    expect(state.rooms.some((room) => room.address === holderAddress(999))).toBe(false);
    expect(state.rooms.some((room) => room.address?.endsWith("dead"))).toBe(false);
    expect(JSON.stringify(state)).not.toContain(FIXTURE_WALLET);
  });

  it("returns the connected stay from canonical rank and Room 100 threshold", async () => {
    await seedRankedHotel(new Date(NOW - 1_000));
    const penthouse = await readCanonicalHotelState(asSql(db), {
      nowMs: NOW,
      wallet: holderAddress(1),
    });
    expect(penthouse.stay).toMatchObject({
      kind: "checked_in",
      room: 1,
      rank: 1,
      bestRoom: 4,
      checkedInSinceMs: Date.parse(CHECKED_IN),
    });

    const lobby = await readCanonicalHotelState(asSql(db), {
      nowMs: NOW,
      wallet: holderAddress(101),
    });
    expect(lobby.stay.kind).toBe("lobby");
    if (lobby.stay.kind !== "lobby") return;
    expect(lobby.stay.rank).toBe(101);
    expect(lobby.stay.room100BalanceRaw).toBe(balanceFor(100));
    expect(lobby.stay.additionalNeededRaw).toBe(
      additionalNeededToBeatTarget({
        userAddress: holderAddress(101),
        userBalance: BigInt(balanceFor(101)),
        targetAddress: holderAddress(100),
        targetBalance: BigInt(balanceFor(100)),
      }).toString(),
    );
  });

  it("withholds occupancy and reports HOTEL SYNCING when the index is stale or not current", async () => {
    await seedRankedHotel(new Date(NOW - 30_001));
    const stale = await readCanonicalHotelState(asSql(db), {
      nowMs: NOW,
      wallet: holderAddress(1),
    });
    expect(stale.syncing).toBe(true);
    expect(stale.publicStatus).toBe(PUBLIC_STATUS.SYNCING);
    expect(stale.freshnessMs).toBe(30_001);
    expect(stale.rooms.every((room) => room.address === null)).toBe(true);
    expect(stale.lobby).toEqual([]);
    expect(stale.room100ThresholdRaw).toBeNull();
    expect(stale.stay.kind).toBe("disconnected");
    const staleView = snapshotFromPublicDto(stale);
    expect(
      presentHeaderStatus({
        hotelLive: staleView.hotelLive,
        fixturePreview: staleView.fixturePreview,
        canaryPending: staleView.canaryPending,
        lastIndexedAtMs: staleView.lastIndexedAtMs,
        nowMs: NOW,
        roomServiceDelayed: staleView.roomServiceDelayed,
        arriving: false,
      }).label,
    ).toBe(PUBLIC_STATUS.SYNCING);

    await db.query(
      `UPDATE system_state SET operational_status = 'INDEXING_GAP', last_indexed_at = $1`,
      [new Date(NOW - 1_000).toISOString()],
    );
    const gap = await readCanonicalHotelState(asSql(db), { nowMs: NOW, wallet: null });
    expect(gap.syncing).toBe(true);
    expect(gap.publicStatus).toBe(PUBLIC_STATUS.SYNCING);
    expect(gap.rooms.every((room) => room.address === null)).toBe(true);
  });

  it("keeps a not-yet-live hotel vacant without loading fixture holders", async () => {
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, 1000)`, [
      holderAddress(1),
    ]);
    const state = await readCanonicalHotelState(asSql(db), { nowMs: NOW, wallet: null });
    expect(state.hotelLive).toBe(false);
    expect(state.syncing).toBe(false);
    expect(state.publicStatus).toBe(PUBLIC_STATUS.CHECK_IN_OPENS_SOON);
    expect(state.rooms.every((room) => room.address === null)).toBe(true);
    expect(JSON.stringify(state)).not.toContain(FIXTURE_WALLET);
    expect(failClosedProductionSnapshot().fixturePreview).toBe(false);
  });

  it("returns public activity only and drops private or unconfirmed claim data", async () => {
    await seedRankedHotel(new Date(NOW - 1_000));
    const guest = holderAddress(7);
    await db.query(
      `INSERT INTO public_activity (event_class, guest_address, payload, occurred_at)
       VALUES ('check-in', $1, '{"room":72,"error":"SECRET_PAYLOAD_ERROR"}'::jsonb, $2)`,
      [guest, new Date(NOW - 500).toISOString()],
    );
    await db.query(
      `INSERT INTO auth_nonces (wallet_address, nonce, domain, expires_at)
       VALUES ($1, 'SECRET_NONCE_VALUE', 'hotel.test', $2)`,
      [guest, new Date(NOW + 60_000).toISOString()],
    );
    await db.query(
      `INSERT INTO operational_incidents (incident_kind, detail)
       VALUES ('OTHER', '{"message":"SECRET_WORKER_ERROR"}'::jsonb)`,
    );
    await db.query(
      `INSERT INTO worker_write_audit (write_kind, phase, success, error_code, detail)
       VALUES ('other', 'failed', false, 'SECRET_AUDIT_CODE', '{"trace":"SECRET_WORKER_TRACE"}'::jsonb)`,
    );
    await db.query(
      `INSERT INTO hotel_deployment (hotel_token_address, notes)
       VALUES ($1, 'SECRET_DEPLOY_NOTE')`,
      [holderAddress(8)],
    );
    await db.query(
      `INSERT INTO guest_entitlements (guest_address, cumulative_earned_wei)
       VALUES ($1, 100)`,
      [guest],
    );
    await db.query(
      `INSERT INTO room_service_claims (
         guest_address, cumulative_entitlement_wei, payout_wei, signer_epoch, tx_hash
       ) VALUES ($1, 100, 100, 1, NULL)`,
      [guest],
    );

    const hidden = await readCanonicalHotelState(asSql(db), { nowMs: NOW, wallet: guest });
    const encoded = JSON.stringify(hidden);
    expect(encoded).not.toContain("SECRET_PAYLOAD_ERROR");
    expect(encoded).not.toContain("SECRET_NONCE_VALUE");
    expect(encoded).not.toContain("SECRET_WORKER_ERROR");
    expect(encoded).not.toContain("SECRET_WORKER_TRACE");
    expect(encoded).not.toContain("SECRET_AUDIT_CODE");
    expect(encoded).not.toContain("SECRET_DEPLOY_NOTE");
    expect(hidden.activity).toEqual([
      expect.objectContaining({
        kind: "check-in",
        summary: expect.stringContaining("Room 72"),
      }),
    ]);
    expect(hidden.stay.kind).toBe("checked_in");
    if (hidden.stay.kind === "checked_in") expect(hidden.stay.claimableWei).toBe("100");
    expect(hidden.market.contract).toBe(holderAddress(8));

    await db.query(
      `INSERT INTO room_service_claims (
         guest_address, cumulative_entitlement_wei, payout_wei, signer_epoch, tx_hash
       ) VALUES ($1, 40, 40, 1, $2)`,
      [guest, `0x${"ab".repeat(32)}`],
    );
    const confirmed = await readCanonicalHotelState(asSql(db), { nowMs: NOW, wallet: guest });
    expect(confirmed.stay.kind).toBe("checked_in");
    if (confirmed.stay.kind === "checked_in") expect(confirmed.stay.claimableWei).toBe("60");
  });

  it("fails closed without a database and never substitutes fixture holders", async () => {
    const missing = await handlePublicHotelState(
      new Request("http://127.0.0.1/api/hotel/state"),
      {},
    );
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ error: "database_unconfigured" });

    const closed = await fetchProductionSnapshot(null, async () => missing);
    expect(closed.source).toBe("production");
    expect(closed.fixturePreview).toBe(false);
    expect(closed.rooms.every((room) => room.occupant === null)).toBe(true);
    expect(JSON.stringify(closed)).not.toContain(FIXTURE_WALLET);
    expect(
      presentHeaderStatus({
        hotelLive: closed.hotelLive,
        fixturePreview: false,
        canaryPending: closed.canaryPending,
        lastIndexedAtMs: closed.lastIndexedAtMs,
        nowMs: NOW,
        roomServiceDelayed: false,
        arriving: false,
      }).label,
    ).toBe(PUBLIC_STATUS.SYNCING);

    await seedRankedHotel(new Date(NOW - 1_000));
    const live = await handlePublicHotelState(
      new Request("http://127.0.0.1/api/hotel/state"),
      {},
      { sql: asSql(db), nowMs: NOW },
    );
    expect(live.status).toBe(200);
    const dto = await live.json();
    const snap = await fetchProductionSnapshot(null, async () => Response.json(dto));
    expect(snap.source).toBe("production");
    expect(snap.rooms[0]?.occupant?.address).toBe(holderAddress(1));
    expect(snap.rooms.some((room) => room.occupant?.address === FIXTURE_WALLET)).toBe(false);
  });
});
