import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { FIXTURE_ADDR, applyHotelMigrations } from "./migrate.js";

const SERVICE_N = 1_888_889n;
const BOUNDARY = Number(SERVICE_N) * 900;

function allocJson(
  rows: Array<{ guest: string; balance: string; alloc: string }>,
): string {
  return JSON.stringify(
    rows.map((r) => ({
      guest_address: r.guest,
      guest_balance_raw: r.balance,
      allocation_wei: r.alloc,
    })),
  );
}

async function finalize(
  db: PGlite,
  args: {
    serviceNumber: bigint | number;
    boundary?: number;
    pool: string;
    eligible: string;
    balance: string;
    claimed: string;
    unallocatedBefore: string;
    financialBlock: string;
    allocations: string;
  },
) {
  const boundary = args.boundary ?? Number(args.serviceNumber) * 900;
  return db.query(
    `SELECT finalize_room_service_round(
      $1::bigint,
      $2::bigint,
      $3::numeric,
      $4::numeric,
      $5::numeric,
      $6::numeric,
      $7::numeric,
      $8::numeric,
      $9::jsonb
    ) AS result`,
    [
      Number(args.serviceNumber),
      boundary,
      args.financialBlock,
      args.pool,
      args.eligible,
      args.balance,
      args.claimed,
      args.unallocatedBefore,
      args.allocations,
    ],
  );
}

describe("Gate D HOTEL database schema + finalize RPC", () => {
  it("applies migrations and creates all canonical tables", async () => {
    const db = await applyHotelMigrations();
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`,
    );
    const names = rows.map((r) => r.table_name);
    for (const required of [
      "hotel_deployment",
      "system_state",
      "holders",
      "holder_balance_checkpoints",
      "processed_transfer_logs",
      "guest_stays",
      "room_history",
      "room_move_events",
      "service_rounds",
      "service_allocations",
      "guest_entitlements",
      "room_service_claims",
      "public_activity",
      "excluded_addresses",
      "auth_nonces",
      "config_versions",
      "config_change_audit",
      "operational_incidents",
      "worker_write_audit",
      "deployment_audits",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("stores financial fields as numeric(78,0) and accepts uint256-scale values", async () => {
    const db = await applyHotelMigrations();
    const { rows } = await db.query<{ data_type: string; numeric_precision: number }>(
      `SELECT data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_name = 'service_rounds' AND column_name = 'service_pool_wei'`,
    );
    expect(rows[0]?.data_type).toBe("numeric");
    expect(Number(rows[0]?.numeric_precision)).toBe(78);

    const huge = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2)`, [
      FIXTURE_ADDR.a,
      huge,
    ]);
    const bal = await db.query<{ balance_raw: string }>(
      `SELECT balance_raw::text FROM holders WHERE address = $1`,
      [FIXTURE_ADDR.a],
    );
    expect(bal.rows[0]?.balance_raw).toBe(huge);
  });

  it("normalizes addresses to lowercase and rejects invalid shapes", async () => {
    const db = await applyHotelMigrations();
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, 1)`, [
      FIXTURE_ADDR.mixed,
    ]);
    const got = await db.query<{ address: string }>(
      `SELECT address FROM holders WHERE balance_raw = 1`,
    );
    expect(got.rows[0]?.address).toBe("0x00000000000000000000000000000000000000aa");

    await expect(
      db.query(`INSERT INTO holders (address, balance_raw) VALUES ('not-an-address', 1)`),
    ).rejects.toThrow();
  });

  it("enforces unique (tx_hash, log_index) for processed transfers", async () => {
    const db = await applyHotelMigrations();
    const tx =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await db.query(
      `INSERT INTO processed_transfer_logs
        (tx_hash, log_index, block_number, from_address, to_address, value_raw)
       VALUES ($1, 0, 10, $2, $3, 1)`,
      [tx, FIXTURE_ADDR.a, FIXTURE_ADDR.b],
    );
    await expect(
      db.query(
        `INSERT INTO processed_transfer_logs
          (tx_hash, log_index, block_number, from_address, to_address, value_raw)
         VALUES ($1, 0, 11, $2, $3, 2)`,
        [tx.toUpperCase(), FIXTURE_ADDR.a, FIXTURE_ADDR.b],
      ),
    ).rejects.toThrow();
  });

  it("finalizes a Service round atomically and records financial_read_block", async () => {
    const db = await applyHotelMigrations();
    const result = await finalize(db, {
      serviceNumber: SERVICE_N,
      pool: "100",
      eligible: "10",
      balance: "40",
      claimed: "60",
      unallocatedBefore: "100",
      financialBlock: "12345",
      allocations: allocJson([
        { guest: FIXTURE_ADDR.a, balance: "6", alloc: "60" },
        { guest: FIXTURE_ADDR.b, balance: "4", alloc: "40" },
      ]),
    });

    const payload = (result.rows[0] as { result: Record<string, unknown> }).result;
    expect(payload.ok).toBe(true);
    expect(String(payload.financial_read_block)).toBe("12345");
    expect(String(payload.dust_wei)).toBe("0");

    const rounds = await db.query<{
      status: string;
      frb: string;
      received: string;
    }>(
      `SELECT service_number, status, financial_read_block::text AS frb,
              total_received_wei::text AS received
       FROM service_rounds WHERE service_number = $1`,
      [Number(SERVICE_N)],
    );
    expect(rounds.rows).toHaveLength(1);
    expect(rounds.rows[0]).toMatchObject({
      status: "finalized",
      frb: "12345",
      received: "100",
    });

    const entitlements = await db.query<{ guest_address: string; earned: string }>(
      `SELECT guest_address, cumulative_earned_wei::text AS earned
       FROM guest_entitlements ORDER BY guest_address`,
    );
    expect(entitlements.rows).toEqual([
      { guest_address: FIXTURE_ADDR.a, earned: "60" },
      { guest_address: FIXTURE_ADDR.b, earned: "40" },
    ]);
  });

  it("blocks duplicate finalization of the same service_number", async () => {
    const db = await applyHotelMigrations();
    const args = {
      serviceNumber: SERVICE_N,
      pool: "10",
      eligible: "1",
      balance: "10",
      claimed: "0",
      unallocatedBefore: "10",
      financialBlock: "1",
      allocations: allocJson([{ guest: FIXTURE_ADDR.a, balance: "1", alloc: "10" }]),
    };
    await finalize(db, args);
    await expect(finalize(db, args)).rejects.toThrow(/already_finalized|duplicate|23505/i);
  });

  it("enforces sequential Service finalization", async () => {
    const db = await applyHotelMigrations();
    await finalize(db, {
      serviceNumber: SERVICE_N,
      pool: "1",
      eligible: "1",
      balance: "1",
      claimed: "0",
      unallocatedBefore: "1",
      financialBlock: "1",
      allocations: "[]",
    });

    await expect(
      finalize(db, {
        serviceNumber: SERVICE_N + 2n,
        pool: "1",
        eligible: "1",
        balance: "1",
        claimed: "0",
        unallocatedBefore: "1",
        financialBlock: "2",
        allocations: "[]",
      }),
    ).rejects.toThrow(/non_sequential/i);

    await finalize(db, {
      serviceNumber: SERVICE_N + 1n,
      pool: "1",
      eligible: "1",
      balance: "1",
      claimed: "0",
      unallocatedBefore: "1",
      financialBlock: "2",
      allocations: "[]",
    });
  });

  it("rolls back on error leaving no partial allocations", async () => {
    const db = await applyHotelMigrations();
    await db.query("BEGIN");
    try {
      await finalize(db, {
        serviceNumber: SERVICE_N,
        pool: "10",
        eligible: "1",
        balance: "10",
        claimed: "0",
        unallocatedBefore: "10",
        financialBlock: "1",
        // allocation exceeds pool ⇒ must fail after/during validation before commit
        allocations: allocJson([{ guest: FIXTURE_ADDR.a, balance: "1", alloc: "11" }]),
      });
      await db.query("COMMIT");
      expect.fail("expected finalize to throw");
    } catch {
      await db.query("ROLLBACK");
    }

    const rounds = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM service_rounds`);
    const allocs = await db.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM service_allocations`,
    );
    const ents = await db.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM guest_entitlements`,
    );
    expect(rounds.rows[0]?.c).toBe(0);
    expect(allocs.rows[0]?.c).toBe(0);
    expect(ents.rows[0]?.c).toBe(0);
  });

  it("keeps finalized rounds immutable", async () => {
    const db = await applyHotelMigrations();
    await finalize(db, {
      serviceNumber: SERVICE_N,
      pool: "5",
      eligible: "1",
      balance: "5",
      claimed: "0",
      unallocatedBefore: "5",
      financialBlock: "9",
      allocations: allocJson([{ guest: FIXTURE_ADDR.a, balance: "1", alloc: "5" }]),
    });

    await expect(
      db.query(`UPDATE service_rounds SET service_pool_wei = 1 WHERE service_number = $1`, [
        Number(SERVICE_N),
      ]),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.query(`DELETE FROM service_allocations WHERE service_number = $1`, [
        Number(SERVICE_N),
      ]),
    ).rejects.toThrow(/immutable/i);
  });

  it("updates guest entitlements monotonically only", async () => {
    const db = await applyHotelMigrations();
    await finalize(db, {
      serviceNumber: SERVICE_N,
      pool: "10",
      eligible: "1",
      balance: "10",
      claimed: "0",
      unallocatedBefore: "10",
      financialBlock: "1",
      allocations: allocJson([{ guest: FIXTURE_ADDR.a, balance: "1", alloc: "10" }]),
    });
    await finalize(db, {
      serviceNumber: SERVICE_N + 1n,
      pool: "3",
      eligible: "1",
      balance: "3",
      claimed: "0",
      unallocatedBefore: "3",
      financialBlock: "2",
      allocations: allocJson([{ guest: FIXTURE_ADDR.a, balance: "1", alloc: "3" }]),
    });

    const earned = await db.query<{ earned: string }>(
      `SELECT cumulative_earned_wei::text AS earned FROM guest_entitlements WHERE guest_address = $1`,
      [FIXTURE_ADDR.a],
    );
    expect(earned.rows[0]?.earned).toBe("13");

    await expect(
      db.query(
        `UPDATE guest_entitlements SET cumulative_earned_wei = 1 WHERE guest_address = $1`,
        [FIXTURE_ADDR.a],
      ),
    ).rejects.toThrow(/non_monotonic/i);
  });

  it("serializes concurrent finalization attempts via advisory lock (one wins)", async () => {
    const db = await applyHotelMigrations();
    const payload = {
      serviceNumber: SERVICE_N,
      pool: "1",
      eligible: "1",
      balance: "1",
      claimed: "0",
      unallocatedBefore: "1",
      financialBlock: "1",
      allocations: "[]",
    };

    const results = await Promise.allSettled([finalize(db, payload), finalize(db, payload)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const count = await db.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM service_rounds WHERE service_number = $1`,
      [Number(SERVICE_N)],
    );
    expect(count.rows[0]?.c).toBe(1);
  });

  it("supports launch/open metadata and excluded addresses without inventing production values", async () => {
    const db = await applyHotelMigrations();
    await db.query(
      `INSERT INTO hotel_deployment (hotel_launch_block, hotel_open_block, hotel_open_timestamp, hotel_live)
       VALUES (100, 200, 1700000000, false)`,
    );
    await db.query(
      `UPDATE system_state SET
         hotel_launch_block = 100,
         hotel_open_block = 200,
         hotel_open_timestamp = 1700000000,
         public_status = 'HOTEL CHECK-IN OPENS SOON'
       WHERE id = 1`,
    );
    await db.query(
      `INSERT INTO excluded_addresses (address, reason, source)
       VALUES ($1, 'test fixture burn', 'burn')`,
      [FIXTURE_ADDR.mixed],
    );
    const excl = await db.query<{ address: string }>(
      `SELECT address FROM excluded_addresses`,
    );
    expect(excl.rows[0]?.address).toBe("0x00000000000000000000000000000000000000aa");
  });
});
