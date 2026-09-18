/**
 * Narrow chain-read interface for the HOTEL indexer.
 * Production uses viem; tests use deterministic mocks.
 * No production RPC URLs are invented here.
 */
export type Hex = `0x${string}`;
export type AddressHex = `0x${string}`;

export type HotelTransferLog = {
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  blockHash: Hex;
  from: AddressHex;
  to: AddressHex;
  valueRaw: bigint;
};

export type GetLogsRange = {
  address: AddressHex;
  fromBlock: bigint;
  toBlock: bigint;
};

export interface ChainReader {
  /** Latest chain tip (unconfirmed absolute head). */
  getLatestBlockNumber(): Promise<bigint>;

  /** Block hash at number, or null if unknown / reorged away. */
  getBlockHash(blockNumber: bigint): Promise<Hex | null>;

  /** ERC-20 Transfer logs in [fromBlock, toBlock] inclusive. Never mempool. */
  getTransferLogs(range: GetLogsRange): Promise<HotelTransferLog[]>;

  /**
   * eth_getCode(wallet, snapshotBlock).
   * Empty code (`0x`) ⇒ EOA at that block.
   */
  getCode(address: AddressHex, blockNumber: bigint): Promise<Hex>;

  /** Block timestamp (unix seconds). Null if the block is missing. */
  getBlockTimestamp(blockNumber: bigint): Promise<number | null>;
}

/** Live indexing head: tip minus live confirmations (never mempool / never tip-only). */
export function indexableHead(latestBlockNumber: bigint, liveConfirmations: number): bigint {
  if (liveConfirmations < 0) {
    throw new Error("liveConfirmations must be >= 0");
  }
  const lag = BigInt(liveConfirmations);
  if (latestBlockNumber < lag) {
    return 0n;
  }
  return latestBlockNumber - lag;
}
