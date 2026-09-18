import { type Address, compareAddressNumeric, normalizeAddress } from "./address.js";
import { HOTEL_ROOM_COUNT, LOBBY_RANK_START, PENTHOUSE_RANK } from "./constants.js";
import type { RawTokenAmount } from "./financial.js";

export type EligibleHolder = {
  address: Address;
  balanceRaw: RawTokenAmount;
};

export type RankedHolder = EligibleHolder & {
  /** 1-based rank among eligible holders */
  rank: number;
};

export type RoomAssignment =
  | { kind: "penthouse"; room: 1; rank: 1 }
  | { kind: "room"; room: number; rank: number }
  | { kind: "lobby"; rank: number }
  | { kind: "not_ranked" };

/**
 * Sort eligible holders:
 * 1. balance raw units DESC
 * 2. wallet numeric address ASC (lower address wins ties)
 */
export function compareHoldersForRanking(a: EligibleHolder, b: EligibleHolder): number {
  if (a.balanceRaw !== b.balanceRaw) {
    return a.balanceRaw > b.balanceRaw ? -1 : 1;
  }
  return compareAddressNumeric(a.address, b.address);
}

export function rankEligibleHolders(holders: EligibleHolder[]): RankedHolder[] {
  const normalized = holders.map((h) => {
    if (h.balanceRaw < 0n) {
      throw new Error("Holder balance must be non-negative");
    }
    return {
      address: normalizeAddress(h.address),
      balanceRaw: h.balanceRaw,
    };
  });

  const sorted = [...normalized].sort(compareHoldersForRanking);
  return sorted.map((h, index) => ({
    ...h,
    rank: index + 1,
  }));
}

/** Map 1-based rank → room / lobby assignment */
export function roomAssignmentForRank(rank: number): RoomAssignment {
  if (!Number.isInteger(rank) || rank < 1) {
    return { kind: "not_ranked" };
  }
  if (rank === PENTHOUSE_RANK) {
    return { kind: "penthouse", room: 1, rank: 1 };
  }
  if (rank <= HOTEL_ROOM_COUNT) {
    return { kind: "room", room: rank, rank };
  }
  return { kind: "lobby", rank };
}

export function isTopHundredRank(rank: number): boolean {
  return Number.isInteger(rank) && rank >= 1 && rank <= HOTEL_ROOM_COUNT;
}

export function isLobbyRank(rank: number): boolean {
  return Number.isInteger(rank) && rank >= LOBBY_RANK_START;
}

/** Rank-100 holder is the check-in threshold target for lobby guests. */
export function findRankHundredHolder(ranked: RankedHolder[]): RankedHolder | undefined {
  return ranked.find((h) => h.rank === HOTEL_ROOM_COUNT);
}
