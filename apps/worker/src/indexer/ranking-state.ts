import {
  type Address,
  holdersWithEffectiveEscrowBalance,
  type RankedHolder,
  type RoomAssignment,
  rankEligibleHolders,
  roomAssignmentForRank,
  type UnwithdrawnEscrow,
} from "@hotel100/domain";
import type { ChainReader } from "../rpc/types.js";
import { filterEligibleHolders } from "./eligibility.js";
import type { HolderRow } from "./types.js";

/**
 * Live ranking via canonical @hotel100/domain only — no duplicated formulas.
 * Effective balance = wallet-held + unwithdrawn escrow; RoomService excluded via exclusions.
 */
export async function computeLiveRanking(args: {
  reader: ChainReader;
  holders: HolderRow[];
  snapshotBlock: bigint;
  exclusions: Set<string>;
  escrows?: UnwithdrawnEscrow[];
}): Promise<Array<RankedHolder & { assignment: RoomAssignment }>> {
  const withEscrow = holdersWithEffectiveEscrowBalance({
    walletHolders: args.holders.map((h) => ({
      address: h.address as Address,
      balanceRaw: h.balanceRaw,
    })),
    escrows: args.escrows ?? [],
    excludedAddresses: args.exclusions,
  });
  const eligible = await filterEligibleHolders({
    reader: args.reader,
    holders: withEscrow,
    snapshotBlock: args.snapshotBlock,
    exclusions: args.exclusions,
  });
  const ranked = rankEligibleHolders(eligible);
  return ranked.map((h) => ({
    ...h,
    assignment: roomAssignmentForRank(h.rank),
  }));
}
