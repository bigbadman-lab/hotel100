import { readFileSync } from "node:fs";
import { HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import type { Address, Hex } from "viem";
import { toFunctionSelector } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLAIM_ROOM_SERVICE_ABI,
  claimUiAfterSubmit,
  decodeClaimCalldata,
  type EthereumRequest,
  executeRoomServiceClaim,
  prepareRoomServiceClaim,
  ROBINHOOD_CHAIN_ID_HEX,
  submitRoomServiceClaim,
} from "./hotel/claim";

const ACCOUNT = normalizeAddress("0x0000000000000000000000000000000000000abc");
const OTHER = normalizeAddress("0x0000000000000000000000000000000000000abd");
const ROOM = "0x2222222222222222222222222222222222222222" as Address;
const SIGNATURE = `0x${"22".repeat(65)}` as Hex;
const TX_HASH = `0x${"ab".repeat(32)}` as Hex;

type Call = { method: string; params?: unknown[] };

function entitlementFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/challenge")) {
      return new Response(JSON.stringify({ message: "sign-me" }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        guest: ACCOUNT,
        signature: SIGNATURE,
        deadline: "100",
        signerEpoch: "1",
        cumulativeFinalizedEarnedWei: "10",
      }),
      { status: 200 },
    );
  }) as typeof fetch;
}

function mockProvider(
  handlers: Record<string, (params?: unknown[]) => unknown>,
): EthereumRequest & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    request: async ({ method, params }) => {
      calls.push({ method, params });
      const handler = handlers[method];
      if (!handler) throw new Error(`unexpected_${method}`);
      return handler(params);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("production Room Service claim", () => {
  it("does not put a private key in the frontend claim module", () => {
    const source = readFileSync(new URL("./hotel/claim.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/0x[0-9a-fA-F]{64}/);
    expect(source).not.toContain("privateKey");
    expect(source).toContain("eth_sendTransaction");
    expect(CLAIM_ROOM_SERVICE_ABI[0]?.name).toBe("claimRoomService");
  });

  it("prepares an entitlement without sending a transaction", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const result = await prepareRoomServiceClaim({
      origin: "http://127.0.0.1",
      wallet: ACCOUNT,
      signMessage: async () => SIGNATURE,
      fetchImpl: entitlementFetch(),
    });
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits claim calldata from the authenticated wallet and refreshes only after a mocked receipt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const provider = mockProvider({
      eth_chainId: () => ROBINHOOD_CHAIN_ID_HEX,
      eth_estimateGas: () => "0x5208",
      eth_sendTransaction: () => TX_HASH,
      eth_getTransactionReceipt: () => ({ status: "0x1", transactionHash: TX_HASH }),
    });
    const claimableWei = 10n;
    const result = await executeRoomServiceClaim({
      origin: "http://127.0.0.1",
      account: ACCOUNT,
      provider,
      roomServiceAddress: ROOM,
      claimableWei,
      signMessage: async () => SIGNATURE,
      fetchImpl: entitlementFetch(),
      wait: async () => {},
      receiptAttempts: 2,
    });
    const ui = claimUiAfterSubmit({ result, claimableWei });

    expect(result).toEqual({ ok: true, txHash: TX_HASH });
    expect(ui.refresh).toBe(true);
    expect(ui.claimableWei).toBe(claimableWei);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(provider.calls.map((call) => call.method)).toEqual([
      "eth_chainId",
      "eth_estimateGas",
      "eth_sendTransaction",
      "eth_getTransactionReceipt",
    ]);

    const tx = provider.calls[2]?.params?.[0] as {
      from: string;
      to: string;
      data: Hex;
      value: string;
    };
    expect(tx.from).toBe(ACCOUNT);
    expect(tx.to).toBe(ROOM);
    expect(tx.value).toBe("0x0");
    expect(
      tx.data.startsWith(toFunctionSelector("claimRoomService(uint256,uint256,uint256,bytes)")),
    ).toBe(true);
    expect(decodeClaimCalldata(tx.data)).toEqual({
      functionName: "claimRoomService",
      args: [10n, 100n, 1n, SIGNATURE],
    });
    expect(HOTEL_CHAIN_ID).toBe(4663);
    expect(ROBINHOOD_CHAIN_ID_HEX).toBe("0x1237");
  });

  it("prompts a chain switch and does not broadcast on the wrong chain", async () => {
    const provider = mockProvider({
      eth_chainId: () => "0x1",
      wallet_switchEthereumChain: () => null,
    });
    const result = await submitRoomServiceClaim({
      provider,
      account: ACCOUNT,
      roomServiceAddress: ROOM,
      claimableWei: 10n,
      claim: {
        functionName: "claimRoomService",
        guest: ACCOUNT,
        args: [10n, 100n, 1n, SIGNATURE],
      },
    });
    expect(result).toEqual({ ok: false, reason: "wrong_chain" });
    expect(provider.calls.map((call) => call.method)).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    expect(provider.calls[1]?.params).toEqual([{ chainId: "0x1237" }]);
    expect(claimUiAfterSubmit({ result, claimableWei: 10n })).toMatchObject({
      refresh: false,
      claimableWei: 10n,
    });
  });

  it("fails closed when Room Service is not configured", async () => {
    const provider = mockProvider({});
    const result = await executeRoomServiceClaim({
      origin: "http://127.0.0.1",
      account: ACCOUNT,
      provider,
      roomServiceAddress: null,
      claimableWei: 10n,
      signMessage: async () => SIGNATURE,
      fetchImpl: entitlementFetch(),
    });
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
    expect(provider.calls).toEqual([]);
  });

  it("does not offer or send a transaction when nothing is claimable", async () => {
    const provider = mockProvider({});
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("entitlement should not be requested");
    });
    const result = await executeRoomServiceClaim({
      origin: "http://127.0.0.1",
      account: ACCOUNT,
      provider,
      roomServiceAddress: ROOM,
      claimableWei: 0n,
      signMessage: async () => SIGNATURE,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, reason: "nothing_claimable" });
    expect(provider.calls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(claimUiAfterSubmit({ result, claimableWei: 0n }).refresh).toBe(false);
  });

  it("leaves claimable unchanged when the wallet rejects the transaction", async () => {
    const provider = mockProvider({
      eth_chainId: () => ROBINHOOD_CHAIN_ID_HEX,
      eth_estimateGas: () => "0x5208",
      eth_sendTransaction: () => {
        throw { code: 4001, message: "User rejected the request." };
      },
    });
    const claimableWei = 10n;
    const result = await submitRoomServiceClaim({
      provider,
      account: ACCOUNT,
      roomServiceAddress: ROOM,
      claimableWei,
      claim: {
        functionName: "claimRoomService",
        guest: ACCOUNT,
        args: [10n, 100n, 1n, SIGNATURE],
      },
    });
    const ui = claimUiAfterSubmit({ result, claimableWei });
    expect(result).toEqual({ ok: false, reason: "rejected" });
    expect(ui.refresh).toBe(false);
    expect(ui.claimableWei).toBe(claimableWei);
    expect(provider.calls.map((call) => call.method)).not.toContain("eth_getTransactionReceipt");
  });

  it("refuses a claim that is not for the connected wallet", async () => {
    const provider = mockProvider({});
    const result = await submitRoomServiceClaim({
      provider,
      account: ACCOUNT,
      roomServiceAddress: ROOM,
      claimableWei: 10n,
      claim: {
        functionName: "claimRoomService",
        guest: OTHER,
        args: [10n, 100n, 1n, SIGNATURE],
      },
    });
    expect(result).toEqual({ ok: false, reason: "rejected" });
    expect(provider.calls).toEqual([]);
  });
});
