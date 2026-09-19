import { type Address, HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import { createPublicClient, getAddress, http } from "viem";
import { EntitlementError } from "../entitlement/errors";

export type CheckInChainReader = {
  eligibilitySigner(): Promise<Address>;
  eligibilitySignerEpoch(): Promise<bigint>;
  hasUnwithdrawnStay(guest: Address): Promise<boolean>;
  getCode(address: Address): Promise<string>;
};

const roomServiceCheckInAbi = [
  {
    type: "function",
    name: "eligibilitySigner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "signer", type: "address" }],
  },
  {
    type: "function",
    name: "eligibilitySignerEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "epoch", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasUnwithdrawnStay",
    stateMutability: "view",
    inputs: [{ name: "guest", type: "address" }],
    outputs: [{ name: "active", type: "bool" }],
  },
] as const;

/**
 * Read-only RoomService check-in views + eth_getCode. No broadcasts.
 */
export function createCheckInChainReader(args: {
  rpcUrl: string;
  roomServiceAddress: Address;
}): CheckInChainReader {
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
    async eligibilitySigner() {
      const signer = await client.readContract({
        address: roomService,
        abi: roomServiceCheckInAbi,
        functionName: "eligibilitySigner",
      });
      return normalizeAddress(signer);
    },
    async eligibilitySignerEpoch() {
      return client.readContract({
        address: roomService,
        abi: roomServiceCheckInAbi,
        functionName: "eligibilitySignerEpoch",
      });
    },
    async hasUnwithdrawnStay(guest) {
      return client.readContract({
        address: roomService,
        abi: roomServiceCheckInAbi,
        functionName: "hasUnwithdrawnStay",
        args: [getAddress(guest)],
      });
    },
    async getCode(address) {
      const code = await client.getCode({ address: getAddress(address) });
      return code ?? "0x";
    },
  };
}

export function isEmptyCode(code: string): boolean {
  return code === "0x" || code === "0x0" || code === "";
}
