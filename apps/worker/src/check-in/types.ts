import type { Address } from "@hotel100/domain";
import type { AddressHex, CheckInStayLog, Hex } from "../rpc/types.js";

export type CheckedInLog = Extract<CheckInStayLog, { kind: "CheckedIn" }>;
export type CheckedOutLog = Extract<CheckInStayLog, { kind: "CheckedOut" }>;
export type CheckInEventLog = CheckInStayLog;

export type UnwithdrawnEscrowRow = {
  guestAddress: Address;
  amountRaw: bigint;
  checkInTimestamp: number;
  unlockTimestamp: number;
  checkInBlock: bigint;
  checkoutBlock: bigint | null;
};

export type { AddressHex, Hex };
