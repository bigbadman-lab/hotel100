import type {
  AddressHex,
  ChainReader,
  CheckInStayLog,
  GetLogsRange,
  Hex,
  HotelTransferLog,
} from "./types.js";

export type MockBlock = {
  number: bigint;
  hash: Hex;
};

/**
 * Deterministic in-memory chain for Gate E tests — no real RPC credentials.
 */
export class MockChainReader implements ChainReader {
  latest: bigint;
  blocks = new Map<string, Hex>();
  /** blockNumber → transfers */
  transfersByBlock = new Map<string, HotelTransferLog[]>();
  /** blockNumber → check-in stay logs */
  checkInByBlock = new Map<string, CheckInStayLog[]>();
  /** address → blockNumber → code */
  codes = new Map<string, Map<string, Hex>>();

  constructor(latest: bigint) {
    this.latest = latest;
  }

  setBlock(blockNumber: bigint, hash: Hex): void {
    this.blocks.set(blockNumber.toString(), hash);
  }

  setBlocks(from: bigint, to: bigint, hashPrefix = "0xblk"): void {
    for (let b = from; b <= to; b++) {
      const n = b.toString(16).padStart(8, "0");
      this.setBlock(b, `${hashPrefix}${n}`.padEnd(66, "0") as Hex);
    }
  }

  removeBlock(blockNumber: bigint): void {
    this.blocks.delete(blockNumber.toString());
  }

  setCode(address: AddressHex, blockNumber: bigint, code: Hex): void {
    const addr = address.toLowerCase();
    if (!this.codes.has(addr)) this.codes.set(addr, new Map());
    this.codes.get(addr)?.set(blockNumber.toString(), code);
  }

  addTransfer(log: HotelTransferLog): void {
    const key = log.blockNumber.toString();
    const list = this.transfersByBlock.get(key) ?? [];
    list.push(log);
    this.transfersByBlock.set(key, list);
  }

  addCheckInLog(log: CheckInStayLog): void {
    const key = log.blockNumber.toString();
    const list = this.checkInByBlock.get(key) ?? [];
    list.push(log);
    this.checkInByBlock.set(key, list);
  }

  async getLatestBlockNumber(): Promise<bigint> {
    return this.latest;
  }

  async getBlockHash(blockNumber: bigint): Promise<Hex | null> {
    return this.blocks.get(blockNumber.toString()) ?? null;
  }

  async getTransferLogs(range: GetLogsRange): Promise<HotelTransferLog[]> {
    const out: HotelTransferLog[] = [];
    for (let b = range.fromBlock; b <= range.toBlock; b++) {
      const list = this.transfersByBlock.get(b.toString()) ?? [];
      for (const log of list) {
        if (log.from && log.to) {
          out.push({
            ...log,
            from: log.from.toLowerCase() as AddressHex,
            to: log.to.toLowerCase() as AddressHex,
            txHash: log.txHash.toLowerCase() as Hex,
          });
        }
      }
    }
    return out;
  }

  async getCheckInLogs(range: GetLogsRange): Promise<CheckInStayLog[]> {
    const out: CheckInStayLog[] = [];
    for (let b = range.fromBlock; b <= range.toBlock; b++) {
      const list = this.checkInByBlock.get(b.toString()) ?? [];
      out.push(...list);
    }
    return out.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
      return a.logIndex - b.logIndex;
    });
  }

  async getCode(address: AddressHex, blockNumber: bigint): Promise<Hex> {
    const addr = address.toLowerCase();
    const byBlock = this.codes.get(addr);
    if (byBlock?.has(blockNumber.toString())) {
      return byBlock.get(blockNumber.toString()) as Hex;
    }
    // Default EOA
    return "0x";
  }

  /** Optional explicit timestamps; default is block number as unix seconds. */
  timestamps = new Map<string, number>();

  setTimestamp(blockNumber: bigint, timestamp: number): void {
    this.timestamps.set(blockNumber.toString(), timestamp);
  }

  async getBlockTimestamp(blockNumber: bigint): Promise<number | null> {
    if (!this.blocks.has(blockNumber.toString())) return null;
    return this.timestamps.get(blockNumber.toString()) ?? Number(blockNumber);
  }
}

export function transferFixture(args: {
  blockNumber: bigint;
  blockHash: Hex;
  txHash: Hex;
  logIndex: number;
  from: AddressHex;
  to: AddressHex;
  valueRaw: bigint;
}): HotelTransferLog {
  return {
    blockNumber: args.blockNumber,
    blockHash: args.blockHash,
    txHash: args.txHash,
    logIndex: args.logIndex,
    from: args.from,
    to: args.to,
    valueRaw: args.valueRaw,
  };
}
