/** Integer-only financial / balance primitives (bigint). Never use floating point. */

export type Wei = bigint;
export type RawTokenAmount = bigint;

export function assertNonNegativeInteger(value: bigint, label: string): void {
  if (value < 0n) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

/** max(a - b, 0) in integer space */
export function saturatingSub(a: bigint, b: bigint): bigint {
  return a > b ? a - b : 0n;
}

/** floor(numerator / denominator); reverts conceptually on div-by-zero */
export function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("floorDiv: division by zero");
  }
  if (numerator < 0n || denominator < 0n) {
    throw new Error("floorDiv: negative values are not allowed");
  }
  return numerator / denominator;
}

/**
 * Pure pro-rata Room Service allocation (integer floor).
 * allocationWei = floor(servicePoolWei * guestBalanceRaw / totalEligibleBalanceRaw)
 */
export function proRataAllocationWei(
  servicePoolWei: Wei,
  guestBalanceRaw: RawTokenAmount,
  totalEligibleBalanceRaw: RawTokenAmount,
): Wei {
  assertNonNegativeInteger(servicePoolWei, "servicePoolWei");
  assertNonNegativeInteger(guestBalanceRaw, "guestBalanceRaw");
  assertNonNegativeInteger(totalEligibleBalanceRaw, "totalEligibleBalanceRaw");
  if (totalEligibleBalanceRaw === 0n) {
    return 0n;
  }
  return floorDiv(servicePoolWei * guestBalanceRaw, totalEligibleBalanceRaw);
}

/**
 * Authoritative claim-invariant receipt formula (§10):
 * totalReceivedWei = contractBalanceWei + totalRoomServiceClaimedWei
 */
export function totalReceivedWei(contractBalanceWei: Wei, totalRoomServiceClaimedWei: Wei): Wei {
  assertNonNegativeInteger(contractBalanceWei, "contractBalanceWei");
  assertNonNegativeInteger(totalRoomServiceClaimedWei, "totalRoomServiceClaimedWei");
  return contractBalanceWei + totalRoomServiceClaimedWei;
}

/**
 * unallocatedWei = totalReceivedWei - totalFinalizedRoomServiceEarnedWei
 */
export function unallocatedWei(totalReceived: Wei, totalFinalizedRoomServiceEarnedWei: Wei): Wei {
  assertNonNegativeInteger(totalReceived, "totalReceivedWei");
  assertNonNegativeInteger(
    totalFinalizedRoomServiceEarnedWei,
    "totalFinalizedRoomServiceEarnedWei",
  );
  if (totalFinalizedRoomServiceEarnedWei > totalReceived) {
    throw new Error("unallocatedWei: finalized earned exceeds total received");
  }
  return totalReceived - totalFinalizedRoomServiceEarnedWei;
}

/** Claim payout = cumulativeEntitlement - alreadyClaimed (must be > 0 to claim) */
export function claimPayoutWei(cumulativeEntitlement: Wei, alreadyClaimed: Wei): Wei {
  assertNonNegativeInteger(cumulativeEntitlement, "cumulativeEntitlement");
  assertNonNegativeInteger(alreadyClaimed, "alreadyClaimed");
  if (cumulativeEntitlement < alreadyClaimed) {
    throw new Error("claimPayoutWei: cumulative entitlement below claimed");
  }
  return cumulativeEntitlement - alreadyClaimed;
}
