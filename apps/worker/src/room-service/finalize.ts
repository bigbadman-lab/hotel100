import type { SqlExecutor } from "../indexer/sql.js";

export type FinalizeArgs = {
  serviceNumber: number;
  boundaryTimestamp: number;
  financialReadBlock: bigint;
  servicePoolWei: bigint;
  totalEligibleBalanceRaw: bigint;
  contractBalanceWei: bigint;
  totalRoomServiceClaimedWei: bigint;
  unallocatedWeiBefore: bigint;
  allocations: Array<{
    guestAddress: string;
    guestBalanceRaw: bigint;
    allocationWei: bigint;
  }>;
};

export async function submitServiceFinalization(
  db: SqlExecutor,
  args: FinalizeArgs,
): Promise<{ alreadyFinalized: boolean }> {
  const payload = JSON.stringify(
    args.allocations.map((a) => ({
      guest_address: a.guestAddress,
      guest_balance_raw: a.guestBalanceRaw.toString(),
      allocation_wei: a.allocationWei.toString(),
    })),
  );

  try {
    await db.query(
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
      )`,
      [
        args.serviceNumber,
        args.boundaryTimestamp,
        args.financialReadBlock.toString(),
        args.servicePoolWei.toString(),
        args.totalEligibleBalanceRaw.toString(),
        args.contractBalanceWei.toString(),
        args.totalRoomServiceClaimedWei.toString(),
        args.unallocatedWeiBefore.toString(),
        payload,
      ],
    );
    return { alreadyFinalized: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already_finalized") || message.includes("23505")) {
      return { alreadyFinalized: true };
    }
    throw err;
  }
}

export async function lastFinalizedServiceNumber(db: SqlExecutor): Promise<number | null> {
  const { rows } = await db.query<{ n: string | null }>(
    `SELECT MAX(service_number)::text AS n FROM service_rounds`,
  );
  const n = rows[0]?.n;
  return n === null || n === undefined ? null : Number(n);
}

export async function totalFinalizedEarnedWei(db: SqlExecutor): Promise<bigint> {
  const { rows } = await db.query<{ earned: string }>(
    `SELECT COALESCE(SUM(total_allocated_wei), 0)::text AS earned FROM service_rounds`,
  );
  return BigInt(rows[0]?.earned ?? "0");
}
