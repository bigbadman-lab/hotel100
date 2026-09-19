import { type Address, HOTEL_ROOM_COUNT, proRataAllocationWei } from "@hotel100/domain";

export type SnapshotGuest = {
  address: Address;
  /**
   * Pro-rata weight for this Service.
   * Prefer rewardWeightRaw from domain.rewardWeight(); balanceRaw is kept as the
   * allocate input name for catch-up determinism (same field finalization persists).
   */
  balanceRaw: bigint;
  /** Explicit reward weight when distinct from wallet balance (optional mirror). */
  rewardWeightRaw?: bigint;
  rank: number;
};

/**
 * Top-100 pure pro-rata by reward weight. No penthouse bonus, caps, or tiers.
 * Dust = pool - sum(floor allocations) and is not assigned.
 * Uses rewardWeightRaw when present, otherwise balanceRaw (filled with weight by caller).
 */
export function allocateServicePool(args: { servicePoolWei: bigint; guests: SnapshotGuest[] }): {
  allocations: Array<SnapshotGuest & { allocationWei: bigint }>;
  totalAllocatedWei: bigint;
  dustWei: bigint;
} {
  const top = args.guests.filter((g) => g.rank >= 1 && g.rank <= HOTEL_ROOM_COUNT);
  const weightOf = (g: SnapshotGuest): bigint => g.rewardWeightRaw ?? g.balanceRaw;
  const totalEligible = top.reduce((sum, g) => sum + weightOf(g), 0n);
  const allocations = top.map((g) => ({
    ...g,
    balanceRaw: weightOf(g),
    rewardWeightRaw: weightOf(g),
    allocationWei: proRataAllocationWei(args.servicePoolWei, weightOf(g), totalEligible),
  }));
  const totalAllocatedWei = allocations.reduce((sum, a) => sum + a.allocationWei, 0n);
  if (totalAllocatedWei > args.servicePoolWei) {
    throw new Error("allocations exceed service pool");
  }
  return {
    allocations,
    totalAllocatedWei,
    dustWei: args.servicePoolWei - totalAllocatedWei,
  };
}
