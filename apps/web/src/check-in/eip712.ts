import {
  type Address,
  CHECK_IN_AUTH_VALIDITY_SECONDS,
  HOTEL_CHAIN_ID,
  normalizeAddress,
} from "@hotel100/domain";
import { getAddress, type Hex, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EntitlementError } from "../entitlement/errors";

/**
 * Exact domain from RoomService.sol: EIP712("RoomService", "1").
 * Check-in authorizations share the RoomService verifying contract.
 */
export const ROOM_SERVICE_EIP712_NAME = "RoomService";
export const ROOM_SERVICE_EIP712_VERSION = "1";

export const CHECK_IN_AUTHORIZATION_TYPES = {
  CheckInAuthorization: [
    { name: "guest", type: "address" },
    { name: "minAmount", type: "uint256" },
    { name: "maxAmount", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "signerEpoch", type: "uint256" },
  ],
} as const;

export type CheckInAuthorizationMessage = {
  guest: Address;
  minAmount: bigint;
  maxAmount: bigint;
  deadline: bigint;
  nonce: bigint;
  signerEpoch: bigint;
};

export function checkInAuthDeadline(issuedAt: Date): bigint {
  return BigInt(Math.floor(issuedAt.getTime() / 1000) + CHECK_IN_AUTH_VALIDITY_SECONDS);
}

export function roomServiceTypedDomain(verifyingContract: Address) {
  return {
    name: ROOM_SERVICE_EIP712_NAME,
    version: ROOM_SERVICE_EIP712_VERSION,
    chainId: HOTEL_CHAIN_ID,
    verifyingContract: getAddress(verifyingContract),
  } as const;
}

export async function signCheckInAuthorization(args: {
  privateKey: Hex;
  expectedSigner: Address;
  forbiddenSigners: Address[];
  verifyingContract: Address;
  message: CheckInAuthorizationMessage;
}): Promise<Hex> {
  try {
    const account = privateKeyToAccount(args.privateKey);
    const signer = normalizeAddress(account.address);
    const expected = normalizeAddress(args.expectedSigner);
    if (signer !== expected) {
      throw new EntitlementError("eligibility_signer_mismatch", 503);
    }
    for (const forbidden of args.forbiddenSigners) {
      if (signer === normalizeAddress(forbidden)) {
        throw new EntitlementError("eligibility_signer_forbidden", 503);
      }
    }
    if (
      args.message.minAmount < 0n ||
      args.message.maxAmount < args.message.minAmount ||
      args.message.signerEpoch <= 0n ||
      args.message.nonce < 0n
    ) {
      throw new EntitlementError("check_in_inconsistent", 409);
    }
    return await account.signTypedData({
      domain: roomServiceTypedDomain(args.verifyingContract),
      types: CHECK_IN_AUTHORIZATION_TYPES,
      primaryType: "CheckInAuthorization",
      message: {
        guest: getAddress(args.message.guest),
        minAmount: args.message.minAmount,
        maxAmount: args.message.maxAmount,
        deadline: args.message.deadline,
        nonce: args.message.nonce,
        signerEpoch: args.message.signerEpoch,
      },
    });
  } catch (error) {
    if (error instanceof EntitlementError) throw error;
    throw new EntitlementError("eligibility_sign_failed", 503);
  }
}

export async function recoverCheckInAuthorizationSigner(args: {
  signature: Hex;
  verifyingContract: Address;
  message: CheckInAuthorizationMessage;
}): Promise<Address> {
  const recovered = await recoverTypedDataAddress({
    domain: roomServiceTypedDomain(args.verifyingContract),
    types: CHECK_IN_AUTHORIZATION_TYPES,
    primaryType: "CheckInAuthorization",
    message: {
      guest: getAddress(args.message.guest),
      minAmount: args.message.minAmount,
      maxAmount: args.message.maxAmount,
      deadline: args.message.deadline,
      nonce: args.message.nonce,
      signerEpoch: args.message.signerEpoch,
    },
    signature: args.signature,
  });
  return normalizeAddress(recovered);
}
