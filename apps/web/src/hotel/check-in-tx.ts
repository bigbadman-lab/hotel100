import { HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { type ClaimSubmitResult, type EthereumRequest, ROBINHOOD_CHAIN_ID_HEX } from "./claim";

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const CHECK_IN_ROOM_SERVICE_ABI = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "minAmount", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "epoch", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkOut",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getStay",
    stateMutability: "view",
    inputs: [{ name: "guest", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "checkInTimestamp", type: "uint64" },
      { name: "unlockTimestamp", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "hasUnwithdrawnStay",
    stateMutability: "view",
    inputs: [{ name: "guest", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export type PreparedCheckInAuth = {
  guest: Address;
  minAmount: bigint;
  maxAmount: bigint;
  deadline: bigint;
  nonce: bigint;
  signerEpoch: bigint;
  signature: Hex;
  verifyingContract: Address;
};

export type CheckInTxResult =
  | { ok: true; txHash: Hex }
  | {
      ok: false;
      reason:
        | "disabled"
        | "unconfigured"
        | "wrong_chain"
        | "rejected"
        | "reverted"
        | "unconfirmed"
        | "insufficient_allowance"
        | "auth_failed";
    };

type Tx = {
  from: Address;
  to: Address;
  data: Hex;
  value: "0x0";
};

export async function prepareCheckInAuthorization(args: {
  origin: string;
  wallet: Address;
  signMessage: (message: string) => Promise<Hex>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; auth: PreparedCheckInAuth } | { ok: false; reason: "auth_failed" }> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const challengeResponse = await fetchImpl(`${args.origin}/api/check-in/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: args.wallet }),
  });
  if (!challengeResponse.ok) return { ok: false, reason: "auth_failed" };
  const challenge = (await challengeResponse.json()) as { message?: string };
  if (!challenge.message) return { ok: false, reason: "auth_failed" };

  const signature = await args.signMessage(challenge.message);
  const authResponse = await fetchImpl(`${args.origin}/api/check-in/authorize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: challenge.message, signature }),
  });
  if (!authResponse.ok) return { ok: false, reason: "auth_failed" };
  const body = (await authResponse.json()) as {
    guest?: string;
    minAmount?: string;
    maxAmount?: string;
    deadline?: string;
    nonce?: string;
    signerEpoch?: string;
    signature?: string;
    verifyingContract?: string;
  };
  if (
    !body.guest ||
    !body.minAmount ||
    !body.maxAmount ||
    !body.deadline ||
    !body.nonce ||
    !body.signerEpoch ||
    !body.signature ||
    !body.verifyingContract
  ) {
    return { ok: false, reason: "auth_failed" };
  }
  return {
    ok: true,
    auth: {
      guest: normalizeAddress(body.guest),
      minAmount: BigInt(body.minAmount),
      maxAmount: BigInt(body.maxAmount),
      deadline: BigInt(body.deadline),
      nonce: BigInt(body.nonce),
      signerEpoch: BigInt(body.signerEpoch),
      signature: body.signature as Hex,
      verifyingContract: normalizeAddress(body.verifyingContract),
    },
  };
}

export async function readHotelAllowance(args: {
  provider: EthereumRequest;
  token: Address;
  owner: Address;
  spender: Address;
}): Promise<bigint | null> {
  try {
    const data = encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: "allowance",
      args: [normalizeAddress(args.owner), normalizeAddress(args.spender)],
    });
    const result = await args.provider.request({
      method: "eth_call",
      params: [{ to: normalizeAddress(args.token), data }, "latest"],
    });
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]*$/.test(result)) return null;
    return BigInt(result);
  } catch {
    return null;
  }
}

export async function approveExactHotel(args: {
  provider: EthereumRequest;
  account: Address;
  token: Address;
  spender: Address;
  amount: bigint;
  wait?: (ms: number) => Promise<void>;
  receiptAttempts?: number;
}): Promise<CheckInTxResult> {
  const chain = await ensureRobinhoodChain(args.provider);
  if (chain !== "ok") return { ok: false, reason: chain };

  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [normalizeAddress(args.spender), args.amount],
  });
  const tx: Tx = {
    from: normalizeAddress(args.account),
    to: normalizeAddress(args.token),
    data,
    value: "0x0",
  };
  return sendAndConfirm(args.provider, tx, args.wait, args.receiptAttempts);
}

export async function executeCheckIn(args: {
  origin: string;
  account: Address;
  provider: EthereumRequest;
  roomServiceAddress: Address | null | undefined;
  hotelTokenAddress: Address | null | undefined;
  amount: bigint;
  signMessage: (message: string) => Promise<Hex>;
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  receiptAttempts?: number;
}): Promise<CheckInTxResult> {
  if (!args.roomServiceAddress || !args.hotelTokenAddress) {
    return { ok: false, reason: "unconfigured" };
  }
  if (args.amount <= 0n) return { ok: false, reason: "auth_failed" };

  const prepared = await prepareCheckInAuthorization({
    origin: args.origin,
    wallet: args.account,
    signMessage: args.signMessage,
    fetchImpl: args.fetchImpl,
  });
  if (!prepared.ok) return prepared;
  if (normalizeAddress(prepared.auth.guest) !== normalizeAddress(args.account)) {
    return { ok: false, reason: "rejected" };
  }
  if (args.amount < prepared.auth.minAmount || args.amount > prepared.auth.maxAmount) {
    return { ok: false, reason: "auth_failed" };
  }

  const allowance = await readHotelAllowance({
    provider: args.provider,
    token: args.hotelTokenAddress,
    owner: args.account,
    spender: args.roomServiceAddress,
  });
  if (allowance === null || allowance < args.amount) {
    return { ok: false, reason: "insufficient_allowance" };
  }

  const chain = await ensureRobinhoodChain(args.provider);
  if (chain !== "ok") return { ok: false, reason: chain };

  const data = encodeFunctionData({
    abi: CHECK_IN_ROOM_SERVICE_ABI,
    functionName: "checkIn",
    args: [
      args.amount,
      prepared.auth.minAmount,
      prepared.auth.maxAmount,
      prepared.auth.deadline,
      prepared.auth.nonce,
      prepared.auth.signerEpoch,
      prepared.auth.signature,
    ],
  });
  const tx: Tx = {
    from: normalizeAddress(args.account),
    to: normalizeAddress(args.roomServiceAddress),
    data,
    value: "0x0",
  };
  return sendAndConfirm(args.provider, tx, args.wait, args.receiptAttempts);
}

export async function executeCheckOut(args: {
  account: Address;
  provider: EthereumRequest;
  roomServiceAddress: Address | null | undefined;
  wait?: (ms: number) => Promise<void>;
  receiptAttempts?: number;
}): Promise<CheckInTxResult> {
  if (!args.roomServiceAddress) return { ok: false, reason: "unconfigured" };

  const chain = await ensureRobinhoodChain(args.provider);
  if (chain !== "ok") return { ok: false, reason: chain };

  const data = encodeFunctionData({
    abi: CHECK_IN_ROOM_SERVICE_ABI,
    functionName: "checkOut",
    args: [],
  });
  const tx: Tx = {
    from: normalizeAddress(args.account),
    to: normalizeAddress(args.roomServiceAddress),
    data,
    value: "0x0",
  };
  return sendAndConfirm(args.provider, tx, args.wait, args.receiptAttempts);
}

/** Direct contract read fallback when canonical API lags. */
export async function readStayFromContract(args: {
  provider: EthereumRequest;
  roomServiceAddress: Address;
  guest: Address;
}): Promise<{ amount: bigint; checkInTimestamp: bigint; unlockTimestamp: bigint } | null> {
  try {
    const data = encodeFunctionData({
      abi: CHECK_IN_ROOM_SERVICE_ABI,
      functionName: "getStay",
      args: [normalizeAddress(args.guest)],
    });
    const result = await args.provider.request({
      method: "eth_call",
      params: [{ to: normalizeAddress(args.roomServiceAddress), data }, "latest"],
    });
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result) || result.length < 194) {
      return null;
    }
    const raw = result.slice(2);
    const amount = BigInt(`0x${raw.slice(0, 64)}`);
    const checkInTimestamp = BigInt(`0x${raw.slice(64, 128)}`);
    const unlockTimestamp = BigInt(`0x${raw.slice(128, 192)}`);
    return { amount, checkInTimestamp, unlockTimestamp };
  } catch {
    return null;
  }
}

export function checkInUiAfterSubmit(result: CheckInTxResult): { note: string; refresh: boolean } {
  if (result.ok) {
    return { note: "Confirmed. Refreshing hotel state.", refresh: true };
  }
  const note =
    result.reason === "disabled"
      ? "Check-in is not enabled."
      : result.reason === "unconfigured"
        ? "Room Service is not configured. Nothing was broadcast."
        : result.reason === "wrong_chain"
          ? "Switch to Robinhood Chain (4663)."
          : result.reason === "rejected"
            ? "Wallet rejected the transaction."
            : result.reason === "insufficient_allowance"
              ? "Approve the exact HOTEL amount first."
              : result.reason === "auth_failed"
                ? "Eligibility authorization failed."
                : "The transaction was not confirmed.";
  return { note, refresh: false };
}

export function claimResultCompat(result: CheckInTxResult): ClaimSubmitResult {
  if (result.ok) return result;
  if (
    result.reason === "wrong_chain" ||
    result.reason === "rejected" ||
    result.reason === "reverted" ||
    result.reason === "unconfirmed" ||
    result.reason === "unconfigured"
  ) {
    return { ok: false, reason: result.reason };
  }
  return { ok: false, reason: "rejected" };
}

async function ensureRobinhoodChain(
  provider: EthereumRequest,
): Promise<"ok" | "wrong_chain" | "rejected"> {
  let current: number | null;
  try {
    current = parseChainId(await provider.request({ method: "eth_chainId" }));
  } catch (error) {
    if (isUserRejection(error)) return "rejected";
    return "wrong_chain";
  }
  if (current === HOTEL_CHAIN_ID) return "ok";
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ROBINHOOD_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (isUserRejection(error)) return "rejected";
    return "wrong_chain";
  }
  try {
    const after = parseChainId(await provider.request({ method: "eth_chainId" }));
    return after === HOTEL_CHAIN_ID ? "ok" : "wrong_chain";
  } catch (error) {
    if (isUserRejection(error)) return "rejected";
    return "wrong_chain";
  }
}

async function sendAndConfirm(
  provider: EthereumRequest,
  tx: Tx,
  wait: ((ms: number) => Promise<void>) | undefined,
  receiptAttempts: number | undefined,
): Promise<CheckInTxResult> {
  const simulated = await simulateTx(provider, tx);
  if (simulated === "rejected") return { ok: false, reason: "rejected" };
  if (simulated === "reverted") return { ok: false, reason: "reverted" };

  let txHash: unknown;
  try {
    txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
  } catch (error) {
    if (isUserRejection(error)) return { ok: false, reason: "rejected" };
    return { ok: false, reason: "reverted" };
  }
  if (!isTxHash(txHash)) return { ok: false, reason: "unconfirmed" };
  return waitForSuccessReceipt(provider, txHash, wait, receiptAttempts);
}

async function simulateTx(
  provider: EthereumRequest,
  tx: Tx,
): Promise<"ok" | "skip" | "reverted" | "rejected"> {
  try {
    await provider.request({ method: "eth_estimateGas", params: [tx] });
    return "ok";
  } catch (error) {
    if (isUserRejection(error)) return "rejected";
    if (!isMethodMissing(error)) return "reverted";
  }
  try {
    await provider.request({ method: "eth_call", params: [tx, "latest"] });
    return "ok";
  } catch (error) {
    if (isUserRejection(error)) return "rejected";
    if (isMethodMissing(error)) return "skip";
    return "reverted";
  }
}

async function waitForSuccessReceipt(
  provider: EthereumRequest,
  txHash: Hex,
  wait: ((ms: number) => Promise<void>) | undefined,
  attempts: number | undefined,
): Promise<CheckInTxResult> {
  const limit = attempts ?? 20;
  const pause = wait ?? defaultWait;
  for (let attempt = 0; attempt < limit; attempt += 1) {
    let receipt: unknown;
    try {
      receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
    } catch (error) {
      if (isUserRejection(error)) return { ok: false, reason: "rejected" };
      if (!isMethodMissing(error)) return { ok: false, reason: "unconfirmed" };
    }
    const status = receiptStatus(receipt);
    if (status === "success") return { ok: true, txHash };
    if (status === "failed") return { ok: false, reason: "reverted" };
    if (attempt < limit - 1) await pause(500);
  }
  return { ok: false, reason: "unconfirmed" };
}

function receiptStatus(receipt: unknown): "success" | "failed" | "pending" {
  if (!receipt || typeof receipt !== "object" || !("status" in receipt)) return "pending";
  const status = (receipt as { status?: unknown }).status;
  if (status === "0x1" || status === "0x01" || status === 1) return "success";
  if (status === "0x0" || status === "0x00" || status === 0) return "failed";
  return "pending";
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return Number.parseInt(trimmed, 16);
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return null;
}

function isTxHash(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function errorCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "number" && Number.isInteger(code)) return code;
  if (typeof code === "string" && /^-?\d+$/.test(code)) return Number(code);
  return null;
}

function isUserRejection(error: unknown): boolean {
  return errorCode(error) === 4001;
}

function isMethodMissing(error: unknown): boolean {
  if (errorCode(error) === -32601) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /method .* not (found|supported)|does not exist|not available/i.test(message);
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
