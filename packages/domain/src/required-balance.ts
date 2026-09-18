import { addressLessThan, normalizeAddress } from "./address.js";
import type { RawTokenAmount } from "./financial.js";
import { saturatingSub } from "./financial.js";

/**
 * Exact upgrade / check-in requirement (§5):
 *
 * if userAddress < targetAddress (numeric):
 *   requiredBalance = targetBalance
 * else:
 *   requiredBalance = targetBalance + 1 raw unit
 *
 * additionalNeeded = max(requiredBalance - userBalance, 0)
 */
export function requiredBalanceToBeat(args: {
  userAddress: string;
  userBalance: RawTokenAmount;
  targetAddress: string;
  targetBalance: RawTokenAmount;
}): { requiredBalance: RawTokenAmount; additionalNeeded: RawTokenAmount } {
  if (args.userBalance < 0n || args.targetBalance < 0n) {
    throw new Error("Balances must be non-negative raw token units");
  }

  const user = normalizeAddress(args.userAddress);
  const target = normalizeAddress(args.targetAddress);

  const requiredBalance = addressLessThan(user, target)
    ? args.targetBalance
    : args.targetBalance + 1n;

  const additionalNeeded = saturatingSub(requiredBalance, args.userBalance);

  return { requiredBalance, additionalNeeded };
}

/**
 * Tokens needed to occupy the room currently held by `target`
 * (or to enter at the room #100 / lobby threshold when target is rank 100).
 */
export function additionalNeededToBeatTarget(args: {
  userAddress: string;
  userBalance: RawTokenAmount;
  targetAddress: string;
  targetBalance: RawTokenAmount;
}): RawTokenAmount {
  return requiredBalanceToBeat(args).additionalNeeded;
}
