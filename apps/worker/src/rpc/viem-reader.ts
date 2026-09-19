import {
  type Address,
  createPublicClient,
  type Hex,
  http,
  type PublicClient,
  parseAbiItem,
} from "viem";
import type {
  AddressHex,
  ChainReader,
  CheckInStayLog,
  GetLogsRange,
  HotelTransferLog,
} from "./types.js";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

const CHECKED_IN_EVENT = parseAbiItem(
  "event CheckedIn(address indexed guest, uint256 amount, uint64 checkInTimestamp, uint64 unlockTimestamp, uint256 nonce, uint256 eligibilitySignerEpoch)",
);

const CHECKED_OUT_EVENT = parseAbiItem(
  "event CheckedOut(address indexed guest, uint256 amount, uint64 checkOutTimestamp)",
);

/**
 * Viem-backed ChainReader. RPC URL must come from config — never invent production URLs.
 */
export function createViemChainReader(args: { rpcUrl: string; chainId: number }): ChainReader {
  if (!args.rpcUrl || args.rpcUrl.trim() === "") {
    throw new Error("rpcUrl is unresolved — refuse to invent a production RPC URL");
  }

  // chainId retained for future typed-chain binding; transport is URL-driven for Gate E.
  void args.chainId;

  const client: PublicClient = createPublicClient({
    transport: http(args.rpcUrl),
  });

  return {
    async getLatestBlockNumber() {
      return client.getBlockNumber();
    },

    async getBlockHash(blockNumber) {
      try {
        const block = await client.getBlock({ blockNumber });
        return block.hash as Hex;
      } catch {
        return null;
      }
    },

    async getTransferLogs(range: GetLogsRange) {
      const logs = await client.getLogs({
        address: range.address as Address,
        event: TRANSFER_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log): HotelTransferLog => {
        if (
          log.blockNumber === null ||
          log.logIndex === null ||
          !log.blockHash ||
          !log.transactionHash
        ) {
          throw new Error("Transfer log missing block/tx identity — refusing mempool/pending log");
        }
        const from = log.args.from;
        const to = log.args.to;
        const value = log.args.value;
        if (from === undefined || to === undefined || value === undefined) {
          throw new Error("Transfer log missing args");
        }
        return {
          txHash: log.transactionHash as Hex,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash as Hex,
          from: from.toLowerCase() as AddressHex,
          to: to.toLowerCase() as AddressHex,
          valueRaw: value,
        };
      });
    },

    async getCheckInLogs(range: GetLogsRange) {
      const [checkedIn, checkedOut] = await Promise.all([
        client.getLogs({
          address: range.address as Address,
          event: CHECKED_IN_EVENT,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        }),
        client.getLogs({
          address: range.address as Address,
          event: CHECKED_OUT_EVENT,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        }),
      ]);

      const out: CheckInStayLog[] = [];
      for (const log of checkedIn) {
        if (
          log.blockNumber === null ||
          log.logIndex === null ||
          !log.blockHash ||
          !log.transactionHash
        ) {
          throw new Error("CheckedIn log missing block/tx identity");
        }
        const guest = log.args.guest;
        const amount = log.args.amount;
        const checkInTimestamp = log.args.checkInTimestamp;
        const unlockTimestamp = log.args.unlockTimestamp;
        const nonce = log.args.nonce;
        const eligibilitySignerEpoch = log.args.eligibilitySignerEpoch;
        if (
          guest === undefined ||
          amount === undefined ||
          checkInTimestamp === undefined ||
          unlockTimestamp === undefined ||
          nonce === undefined ||
          eligibilitySignerEpoch === undefined
        ) {
          throw new Error("CheckedIn log missing args");
        }
        out.push({
          kind: "CheckedIn",
          txHash: log.transactionHash as Hex,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash as Hex,
          guest: guest.toLowerCase() as AddressHex,
          amount,
          checkInTimestamp: Number(checkInTimestamp),
          unlockTimestamp: Number(unlockTimestamp),
          nonce,
          eligibilitySignerEpoch,
        });
      }
      for (const log of checkedOut) {
        if (
          log.blockNumber === null ||
          log.logIndex === null ||
          !log.blockHash ||
          !log.transactionHash
        ) {
          throw new Error("CheckedOut log missing block/tx identity");
        }
        const guest = log.args.guest;
        const amount = log.args.amount;
        const checkOutTimestamp = log.args.checkOutTimestamp;
        if (guest === undefined || amount === undefined || checkOutTimestamp === undefined) {
          throw new Error("CheckedOut log missing args");
        }
        out.push({
          kind: "CheckedOut",
          txHash: log.transactionHash as Hex,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash as Hex,
          guest: guest.toLowerCase() as AddressHex,
          amount,
          checkOutTimestamp: Number(checkOutTimestamp),
        });
      }
      return out.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
        return a.logIndex - b.logIndex;
      });
    },

    async getCode(address, blockNumber) {
      const code = await client.getCode({
        address: address as Address,
        blockNumber,
      });
      return (code ?? "0x") as Hex;
    },

    async getBlockTimestamp(blockNumber) {
      try {
        const block = await client.getBlock({ blockNumber });
        return Number(block.timestamp);
      } catch {
        return null;
      }
    },
  };
}
