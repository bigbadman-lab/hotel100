import {
  type Address,
  ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS,
  HOTEL_CHAIN_ID,
  normalizeAddress,
} from "@hotel100/domain";
import { getAddress, type Hex, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EntitlementError } from "./errors";

/**
 * Exact domain from RoomService.sol: EIP712("RoomService", "1").
 * Do not rename or version this independently of the contract.
 */
export const ROOM_SERVICE_EIP712_NAME = "RoomService";
export const ROOM_SERVICE_EIP712_VERSION = "1";

export const ROOM_SERVICE_CLAIM_TYPES = {
  RoomServiceClaim: [
    { name: "guest", type: "address" },
    { name: "cumulativeEntitlement", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "signerEpoch", type: "uint256" },
  ],
} as const;

export type RoomServiceClaimMessage = {
  guest: Address;
  cumulativeEntitlement: bigint;
  deadline: bigint;
  signerEpoch: bigint;
};

export function entitlementDeadline(issuedAt: Date): bigint {
  return BigInt(Math.floor(issuedAt.getTime() / 1000) + ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS);
}

export function roomServiceTypedDomain(verifyingContract: Address) {
  return {
    name: ROOM_SERVICE_EIP712_NAME,
    version: ROOM_SERVICE_EIP712_VERSION,
    chainId: HOTEL_CHAIN_ID,
    verifyingContract: getAddress(verifyingContract),
  } as const;
}

export async function signRoomServiceClaim(args: {
  privateKey: Hex;
  expectedSigner: Address;
  forbiddenSigners: Address[];
  verifyingContract: Address;
  message: RoomServiceClaimMessage;
}): Promise<Hex> {
  try {
    const account = privateKeyToAccount(args.privateKey);
    const signer = normalizeAddress(account.address);
    const expected = normalizeAddress(args.expectedSigner);
    if (signer !== expected) {
      throw new EntitlementError("entitlement_signer_mismatch", 503);
    }
    for (const forbidden of args.forbiddenSigners) {
      if (signer === normalizeAddress(forbidden)) {
        throw new EntitlementError("entitlement_signer_forbidden", 503);
      }
    }
    if (args.message.cumulativeEntitlement < 0n || args.message.signerEpoch <= 0n) {
      throw new EntitlementError("entitlement_inconsistent", 409);
    }
    return await account.signTypedData({
      domain: roomServiceTypedDomain(args.verifyingContract),
      types: ROOM_SERVICE_CLAIM_TYPES,
      primaryType: "RoomServiceClaim",
      message: {
        guest: getAddress(args.message.guest),
        cumulativeEntitlement: args.message.cumulativeEntitlement,
        deadline: args.message.deadline,
        signerEpoch: args.message.signerEpoch,
      },
    });
  } catch (error) {
    if (error instanceof EntitlementError) throw error;
    throw new EntitlementError("entitlement_sign_failed", 503);
  }
}

export async function recoverRoomServiceClaimSigner(args: {
  signature: Hex;
  verifyingContract: Address;
  message: RoomServiceClaimMessage;
}): Promise<Address> {
  const recovered = await recoverTypedDataAddress({
    domain: roomServiceTypedDomain(args.verifyingContract),
    types: ROOM_SERVICE_CLAIM_TYPES,
    primaryType: "RoomServiceClaim",
    message: {
      guest: getAddress(args.message.guest),
      cumulativeEntitlement: args.message.cumulativeEntitlement,
      deadline: args.message.deadline,
      signerEpoch: args.message.signerEpoch,
    },
    signature: args.signature,
  });
  return normalizeAddress(recovered);
}
