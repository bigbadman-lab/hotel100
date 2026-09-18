import { type Address, HOTEL_ROOM_COUNT, proRataAllocationWei } from "@hotel100/domain";

export type SnapshotGuest = {
  address: Address;
  balanceRaw: bigint;
  rank: number;
};

/**
 * Top-100 pure pro-rata. No penthouse bonus, weighting, caps, or tiers.
 * Dust = pool - sum(floor allocations) and is not assigned.
 */
export function allocateServicePool(args: { servicePoolWei: bigint; guests: SnapshotGuest[] }): {
  allocations: Array<SnapshotGuest & { allocationWei: bigint }>;
  totalAllocatedWei: bigint;
  dustWei: bigint;
} {
  const top = args.guests.filter((g) => g.rank >= 1 && g.rank <= HOTEL_ROOM_COUNT);
  const totalEligible = top.reduce((sum, g) => sum + g.balanceRaw, 0n);
  const allocations = top.map((g) => ({
    ...g,
    allocationWei: proRataAllocationWei(args.servicePoolWei, g.balanceRaw, totalEligible),
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
