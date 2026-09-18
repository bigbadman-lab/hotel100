import { EntitlementError } from "./errors.js";

/**
 * Canonical cumulative is the finalized guest_entitlements balance.
 * Signed amount is that cumulative, never a larger figure, and never below onchain claimed.
 */
export function reconcileClaimable(args: {
  dbEarnedWei: bigint;
  indexedClaimCumulativeWei: bigint;
  onchainClaimedWei: bigint;
}): { cumulativeWei: bigint; claimableWei: bigint } {
  if (
    args.dbEarnedWei < 0n ||
    args.indexedClaimCumulativeWei < 0n ||
    args.onchainClaimedWei < 0n ||
    args.onchainClaimedWei > args.dbEarnedWei ||
    args.indexedClaimCumulativeWei > args.dbEarnedWei
  ) {
    throw new EntitlementError("entitlement_inconsistent", 409);
  }

  return {
    cumulativeWei: args.dbEarnedWei,
    claimableWei: args.dbEarnedWei - args.onchainClaimedWei,
  };
}
