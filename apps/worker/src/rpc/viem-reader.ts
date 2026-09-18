import {
  type Address,
  createPublicClient,
  type Hex,
  http,
  type PublicClient,
  parseAbiItem,
} from "viem";
import type { AddressHex, ChainReader, GetLogsRange, HotelTransferLog } from "./types.js";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
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
