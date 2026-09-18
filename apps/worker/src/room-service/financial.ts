import { totalReceivedWei, unallocatedWei, type Wei } from "@hotel100/domain";

/**
 * One canonical financial-read block per attempt.
 * Mixed block tags are rejected and must not finalize.
 */
export type FinancialRead = {
  balanceReadBlock: bigint;
  claimedReadBlock: bigint;
  contractBalanceWei: Wei;
  totalRoomServiceClaimedWei: Wei;
};

export interface RoomServiceFinancialReader {
  readAtBlock(blockNumber: bigint): Promise<FinancialRead>;
}

export function assertSingleFinancialReadBlock(read: FinancialRead): bigint {
  if (read.balanceReadBlock !== read.claimedReadBlock) {
    throw new Error("mixed-block financial reads rejected");
  }
  return read.balanceReadBlock;
}

export function computeUnallocated(args: { read: FinancialRead; totalFinalizedEarnedWei: Wei }): {
  financialReadBlock: bigint;
  totalReceived: Wei;
  unallocated: Wei;
} {
  const financialReadBlock = assertSingleFinancialReadBlock(args.read);
  const totalReceived = totalReceivedWei(
    args.read.contractBalanceWei,
    args.read.totalRoomServiceClaimedWei,
  );
  const unallocated = unallocatedWei(totalReceived, args.totalFinalizedEarnedWei);
  return { financialReadBlock, totalReceived, unallocated };
}
