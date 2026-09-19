/**
 * Check-in / escrow ranking and Room Service reward-weight helpers.
 * Integer-only — never use floating point for weights or minima.
 */

import { type Address, normalizeAddress } from "./address.js";
import { CHECK_IN_AUTH_VALIDITY_SECONDS, CHECK_IN_DURATION_SECONDS } from "./constants.js";
import { assertNonNegativeInteger, type RawTokenAmount } from "./financial.js";
import type { EligibleHolder } from "./ranking.js";

export { CHECK_IN_AUTH_VALIDITY_SECONDS, CHECK_IN_DURATION_SECONDS };

/** 1.0x = 10_000 bps */
export const BASE_REWARD_WEIGHT_BPS = 10_000n;

/** 1.5x = 15_000 bps — fixed MVP multiplier (immutable product rule) */
export const CHECKED_IN_REWARD_WEIGHT_BPS = 15_000n;

/** Minimum check-in = 10% of effective balance at authorization time */
export const CHECK_IN_MINIMUM_BPS = 1_000n;

/**
 * Ranking / room-assignment balance:
 * walletHeld + unwithdrawn escrow (active or expired).
 */
export function effectiveHotelBalance(
  walletHeld: RawTokenAmount,
  unwithdrawnEscrow: RawTokenAmount,
): RawTokenAmount {
  assertNonNegativeInteger(walletHeld, "walletHeld");
  assertNonNegativeInteger(unwithdrawnEscrow, "unwithdrawnEscrow");
  return walletHeld + unwithdrawnEscrow;
}

/**
 * Minimum check-in amount = ceil(effectiveBalance * 10%).
 * Uses ceiling so tiny balances cannot round down to a free check-in of 0
 * when effectiveBalance > 0; zero effective ⇒ zero min.
 */
export function checkInMinimum(effectiveBalance: RawTokenAmount): RawTokenAmount {
  assertNonNegativeInteger(effectiveBalance, "effectiveBalance");
  if (effectiveBalance === 0n) {
    return 0n;
  }
  return (effectiveBalance * CHECK_IN_MINIMUM_BPS + 9_999n) / 10_000n;
}

export type StayBoostPhase = "none" | "active" | "expired";

/**
 * Stay boost phase at a snapshot/now timestamp.
 * Active only while snapshotTimestamp < unlockTimestamp.
 */
export function stayBoostPhase(args: {
  hasUnwithdrawnStay: boolean;
  unlockTimestamp: number;
  snapshotTimestamp: number;
}): StayBoostPhase {
  if (!args.hasUnwithdrawnStay) {
    return "none";
  }
  if (!Number.isFinite(args.unlockTimestamp) || !Number.isFinite(args.snapshotTimestamp)) {
    throw new Error("stayBoostPhase: timestamps must be finite");
  }
  if (args.snapshotTimestamp < args.unlockTimestamp) {
    return "active";
  }
  return "expired";
}

/**
 * Room Service reward weight for one guest at a snapshot.
 *
 * - Not Top 100 ⇒ 0
 * - Top 100:
 *     walletHeld * 1.0
 *   + expiredUnwithdrawnEscrow * 1.0
 *   + activeEscrow * 1.5
 *
 * Implemented as (units * bps) / BASE so 1.5x is exact integer math.
 */
export function rewardWeight(args: {
  walletHeld: RawTokenAmount;
  escrowAmount: RawTokenAmount;
  isActiveEscrow: boolean;
  isTop100: boolean;
}): RawTokenAmount {
  assertNonNegativeInteger(args.walletHeld, "walletHeld");
  assertNonNegativeInteger(args.escrowAmount, "escrowAmount");

  if (!args.isTop100) {
    return 0n;
  }

  const escrowBps = args.isActiveEscrow ? CHECKED_IN_REWARD_WEIGHT_BPS : BASE_REWARD_WEIGHT_BPS;
  const walletWeighted = args.walletHeld * BASE_REWARD_WEIGHT_BPS;
  const escrowWeighted = args.escrowAmount * escrowBps;
  return (walletWeighted + escrowWeighted) / BASE_REWARD_WEIGHT_BPS;
}

/**
 * Display multiplier for connected-guest UX (0 | 10000 | 15000 bps).
 * 0 when ineligible for Room Service (not Top 100).
 */
export function currentRewardMultiplierBps(args: {
  isTop100: boolean;
  stayPhase: StayBoostPhase;
}): bigint {
  if (!args.isTop100) {
    return 0n;
  }
  if (args.stayPhase === "active") {
    return CHECKED_IN_REWARD_WEIGHT_BPS;
  }
  return BASE_REWARD_WEIGHT_BPS;
}

/** Count toward hotel-level "X / 100 ROOMS CHECKED IN" */
export function countsTowardCheckedInMetric(args: {
  isTop100: boolean;
  stayPhase: StayBoostPhase;
}): boolean {
  return args.isTop100 && args.stayPhase === "active";
}

/** Unwithdrawn escrow row used for ranking / reward reconstruction. */
export type UnwithdrawnEscrow = {
  guestAddress: Address;
  amountRaw: RawTokenAmount;
  checkInTimestamp: number;
  unlockTimestamp: number;
};

/**
 * Whether a position was still escrowed at a snapshot block.
 * Open if checked in at/before snapshot and not yet checked out at/before snapshot.
 */
export function escrowOpenAtSnapshot(args: {
  checkInBlock: bigint;
  checkoutBlock: bigint | null;
  snapshotBlock: bigint;
}): boolean {
  if (args.checkInBlock > args.snapshotBlock) return false;
  if (args.checkoutBlock !== null && args.checkoutBlock <= args.snapshotBlock) return false;
  return true;
}

/**
 * Ranking inputs: wallet-held + unwithdrawn escrow per guest.
 * Excluded addresses (burns, RoomService, protocol) are dropped.
 * Direct HOTEL held by an excluded contract is never attributed to guests here —
 * only explicit escrow rows create guest attribution.
 */
export function holdersWithEffectiveEscrowBalance(args: {
  walletHolders: EligibleHolder[];
  escrows: UnwithdrawnEscrow[];
  excludedAddresses: ReadonlySet<string>;
}): EligibleHolder[] {
  const escrowByGuest = new Map<string, RawTokenAmount>();
  for (const row of args.escrows) {
    const guest = normalizeAddress(row.guestAddress);
    assertNonNegativeInteger(row.amountRaw, "escrow.amountRaw");
    escrowByGuest.set(guest, (escrowByGuest.get(guest) ?? 0n) + row.amountRaw);
  }

  const merged = new Map<string, RawTokenAmount>();
  for (const holder of args.walletHolders) {
    const address = normalizeAddress(holder.address);
    if (args.excludedAddresses.has(address)) continue;
    assertNonNegativeInteger(holder.balanceRaw, "walletHeld");
    if (holder.balanceRaw > 0n) {
      merged.set(address, holder.balanceRaw);
    }
  }
  for (const [guest, escrow] of escrowByGuest) {
    if (args.excludedAddresses.has(guest)) continue;
    const wallet = merged.get(guest) ?? 0n;
    const effective = effectiveHotelBalance(wallet, escrow);
    if (effective > 0n) merged.set(guest, effective);
  }

  return [...merged.entries()].map(([address, balanceRaw]) => ({
    address: address as Address,
    balanceRaw,
  }));
}

/**
 * Fail-closed coherence: total unwithdrawn escrow must not exceed RoomService HOTEL balance.
 * Surplus (direct transfers) is allowed; under-backing is not.
 */
export function escrowCoherentWithRoomServiceBalance(args: {
  unwithdrawnEscrowTotal: RawTokenAmount;
  roomServiceBalanceRaw: RawTokenAmount;
}): boolean {
  assertNonNegativeInteger(args.unwithdrawnEscrowTotal, "unwithdrawnEscrowTotal");
  assertNonNegativeInteger(args.roomServiceBalanceRaw, "roomServiceBalanceRaw");
  return args.unwithdrawnEscrowTotal <= args.roomServiceBalanceRaw;
}
