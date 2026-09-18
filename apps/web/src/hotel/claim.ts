import { HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import { type Address, decodeFunctionData, encodeFunctionData, type Hex } from "viem";

/**
 * Supported wallet surface: EIP-1193 injected provider (`window.ethereum`).
 * Desktop extensions and mobile in-app browsers that inject this provider.
 * Methods used: eth_requestAccounts, personal_sign, eth_chainId,
 * wallet_switchEthereumChain, eth_estimateGas, eth_call, eth_sendTransaction,
 * eth_getTransactionReceipt.
 * The connected account is msg.sender. No WalletConnect, no relayer, no private key.
 */
export const CLAIM_ROOM_SERVICE_ABI = [
  {
    type: "function",
    name: "claimRoomService",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cumulativeEntitlement", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "epoch", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const ROBINHOOD_CHAIN_ID_HEX = `0x${HOTEL_CHAIN_ID.toString(16)}` as const;

export type EthereumRequest = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type PreparedRoomServiceClaim = {
  functionName: "claimRoomService";
  guest: Address;
  args: readonly [bigint, bigint, bigint, Hex];
};

export type ClaimPrepareResult =
  | { ok: true; claim: PreparedRoomServiceClaim }
  | { ok: false; reason: "nothing_claimable" | "unconfigured" | "rejected" };

export type ClaimSubmitResult =
  | { ok: true; txHash: Hex }
  | {
      ok: false;
      reason:
        | "nothing_claimable"
        | "unconfigured"
        | "wrong_chain"
        | "rejected"
        | "reverted"
        | "unconfirmed";
    };

type ClaimTx = {
  from: Address;
  to: Address;
  data: Hex;
  value: "0x0";
};

/**
 * Wallet proof + Gate G entitlement payload.
 * Does not submit a transaction.
 */
export async function prepareRoomServiceClaim(args: {
  origin: string;
  wallet: Address;
  signMessage: (message: string) => Promise<Hex>;
  fetchImpl?: typeof fetch;
}): Promise<ClaimPrepareResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const challengeResponse = await fetchImpl(`${args.origin}/api/entitlement/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: args.wallet }),
  });
  if (!challengeResponse.ok) return { ok: false, reason: "rejected" };
  const challenge = (await challengeResponse.json()) as { message?: string };
  if (!challenge.message) return { ok: false, reason: "rejected" };

  const signature = await args.signMessage(challenge.message);
  const entitlementResponse = await fetchImpl(`${args.origin}/api/entitlement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: challenge.message, signature }),
  });
  if (!entitlementResponse.ok) return { ok: false, reason: "rejected" };
  const body = (await entitlementResponse.json()) as {
    signature?: string | null;
    deadline?: string | null;
    signerEpoch?: string;
    cumulativeFinalizedEarnedWei?: string;
    guest?: string;
  };
  if (
    !body.signature ||
    !body.deadline ||
    !body.signerEpoch ||
    !body.cumulativeFinalizedEarnedWei
  ) {
    return { ok: false, reason: "nothing_claimable" };
  }

  return {
    ok: true,
    claim: {
      functionName: "claimRoomService",
      guest: normalizeAddress(body.guest ?? args.wallet),
      args: [
        BigInt(body.cumulativeFinalizedEarnedWei),
        BigInt(body.deadline),
        BigInt(body.signerEpoch),
        body.signature as Hex,
      ],
    },
  };
}

export async function executeRoomServiceClaim(args: {
  origin: string;
  account: Address;
  provider: EthereumRequest;
  roomServiceAddress: Address | null | undefined;
  claimableWei: bigint;
  signMessage: (message: string) => Promise<Hex>;
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  receiptAttempts?: number;
}): Promise<ClaimSubmitResult> {
  if (args.claimableWei <= 0n) return { ok: false, reason: "nothing_claimable" };
  if (!args.roomServiceAddress) return { ok: false, reason: "unconfigured" };

  const prepared = await prepareRoomServiceClaim({
    origin: args.origin,
    wallet: args.account,
    signMessage: args.signMessage,
    fetchImpl: args.fetchImpl,
  });
  if (!prepared.ok) return prepared;

  return submitRoomServiceClaim({
    provider: args.provider,
    account: args.account,
    roomServiceAddress: args.roomServiceAddress,
    claim: prepared.claim,
    claimableWei: args.claimableWei,
    wait: args.wait,
    receiptAttempts: args.receiptAttempts,
  });
}

/**
 * Connected-wallet claim. The wallet prompt is the explicit confirmation.
 * Nothing is marked claimed until a successful receipt is observed.
 */
export async function submitRoomServiceClaim(args: {
  provider: EthereumRequest;
  account: Address;
  roomServiceAddress: Address | null | undefined;
  claim: PreparedRoomServiceClaim;
  claimableWei: bigint;
  wait?: (ms: number) => Promise<void>;
  receiptAttempts?: number;
}): Promise<ClaimSubmitResult> {
  if (args.claimableWei <= 0n) return { ok: false, reason: "nothing_claimable" };
  if (!args.roomServiceAddress) return { ok: false, reason: "unconfigured" };
  if (normalizeAddress(args.claim.guest) !== normalizeAddress(args.account)) {
    return { ok: false, reason: "rejected" };
  }

  const chain = await ensureRobinhoodChain(args.provider);
  if (chain !== "ok") return { ok: false, reason: chain };

  const data = encodeFunctionData({
    abi: CLAIM_ROOM_SERVICE_ABI,
    functionName: "claimRoomService",
    args: args.claim.args,
  });
  const tx: ClaimTx = {
    from: normalizeAddress(args.account),
    to: normalizeAddress(args.roomServiceAddress),
    data,
    value: "0x0",
  };

  const simulated = await simulateClaim(args.provider, tx);
  if (simulated === "rejected") return { ok: false, reason: "rejected" };
  if (simulated === "reverted") return { ok: false, reason: "reverted" };

  let txHash: unknown;
  try {
    txHash = await args.provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
  } catch (error) {
    if (isUserRejection(error)) return { ok: false, reason: "rejected" };
    return { ok: false, reason: "reverted" };
  }
  if (!isTxHash(txHash)) return { ok: false, reason: "unconfirmed" };
  return waitForSuccessReceipt(args.provider, txHash, args.wait, args.receiptAttempts);
}

export function claimUiAfterSubmit(args: { result: ClaimSubmitResult; claimableWei: bigint }): {
  note: string;
  refresh: boolean;
  claimableWei: bigint;
} {
  if (args.result.ok) {
    return {
      note: "Claim confirmed. Refreshing hotel state.",
      refresh: true,
      claimableWei: args.claimableWei,
    };
  }
  const note =
    args.result.reason === "nothing_claimable"
      ? "Nothing to claim."
      : args.result.reason === "unconfigured"
        ? "Room Service is not configured. Nothing was broadcast."
        : args.result.reason === "wrong_chain"
          ? "Switch to Robinhood Chain (4663) to claim."
          : args.result.reason === "rejected"
            ? "Wallet rejected the transaction. Your claimable amount is unchanged."
            : "The claim was not confirmed. Your claimable amount is unchanged.";
  return { note, refresh: false, claimableWei: args.claimableWei };
}

export function decodeClaimCalldata(data: Hex): {
  functionName: string;
  args: readonly [bigint, bigint, bigint, Hex];
} {
  const decoded = decodeFunctionData({ abi: CLAIM_ROOM_SERVICE_ABI, data });
  return {
    functionName: decoded.functionName,
    args: decoded.args as readonly [bigint, bigint, bigint, Hex],
  };
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

async function simulateClaim(
  provider: EthereumRequest,
  tx: ClaimTx,
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
): Promise<ClaimSubmitResult> {
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
