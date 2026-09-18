import {
  type RankedHolder,
  type RoomAssignment,
  rankEligibleHolders,
  roomAssignmentForRank,
} from "@hotel100/domain";
import type { ChainReader } from "../rpc/types.js";
import { filterEligibleHolders } from "./eligibility.js";
import type { HolderRow } from "./types.js";

/**
 * Live ranking via canonical @hotel100/domain only — no duplicated formulas.
 */
export async function computeLiveRanking(args: {
  reader: ChainReader;
  holders: HolderRow[];
  snapshotBlock: bigint;
  exclusions: Set<string>;
}): Promise<Array<RankedHolder & { assignment: RoomAssignment }>> {
  const eligible = await filterEligibleHolders({
    reader: args.reader,
    holders: args.holders,
    snapshotBlock: args.snapshotBlock,
    exclusions: args.exclusions,
  });
  const ranked = rankEligibleHolders(eligible);
  return ranked.map((h) => ({
    ...h,
    assignment: roomAssignmentForRank(h.rank),
  }));
}
