import { type Address, HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import { createPublicClient, getAddress, http } from "viem";
import { EntitlementError } from "./errors";

export type RoomServiceChainReader = {
  roomServiceClaimed(guest: Address): Promise<bigint>;
  signerEpoch(): Promise<bigint>;
  entitlementSigner(): Promise<Address>;
};

const roomServiceReadsAbi = [
  {
    type: "function",
    name: "roomServiceClaimed",
    stateMutability: "view",
    inputs: [{ name: "guest", type: "address" }],
    outputs: [{ name: "claimed", type: "uint256" }],
  },
  {
    type: "function",
    name: "signerEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "epoch", type: "uint256" }],
  },
  {
    type: "function",
    name: "entitlementSigner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "signer", type: "address" }],
  },
] as const;

/**
 * Read-only RoomService view calls. No broadcasts.
 * RPC URL is the configured value only — never invented and never logged.
 */
export function createRoomServiceReader(args: {
  rpcUrl: string;
  roomServiceAddress: Address;
}): RoomServiceChainReader {
  const rpcUrl = args.rpcUrl.trim();
  if (!rpcUrl) {
    throw new EntitlementError("rpc_unconfigured", 503);
  }
  const roomService = getAddress(args.roomServiceAddress);
  const client = createPublicClient({
    chain: {
      id: HOTEL_CHAIN_ID,
      name: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });

  return {
    async roomServiceClaimed(guest) {
      return client.readContract({
        address: roomService,
        abi: roomServiceReadsAbi,
        functionName: "roomServiceClaimed",
        args: [getAddress(guest)],
      });
    },
    async signerEpoch() {
      return client.readContract({
        address: roomService,
        abi: roomServiceReadsAbi,
        functionName: "signerEpoch",
      });
    },
    async entitlementSigner() {
      const signer = await client.readContract({
        address: roomService,
        abi: roomServiceReadsAbi,
        functionName: "entitlementSigner",
      });
      return normalizeAddress(signer);
    },
  };
}
