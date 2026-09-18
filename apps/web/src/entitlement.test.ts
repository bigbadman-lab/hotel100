import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import {
  type Address,
  ENTITLEMENT_CHALLENGE_TTL_SECONDS,
  ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS,
  HOTEL_CHAIN_ID,
  normalizeAddress,
} from "@hotel100/domain";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROOM_SERVICE_EIP712_NAME,
  ROOM_SERVICE_EIP712_VERSION,
  recoverRoomServiceClaimSigner,
  signRoomServiceClaim,
} from "./entitlement/eip712";
import { EntitlementError } from "./entitlement/errors";
import {
  type EntitlementDeps,
  handleCreateChallenge,
  handleEntitlement,
} from "./entitlement/handlers";
import { loadEntitlementDeps, requireDatabaseUrl } from "./entitlement/production";
import { defaultRateLimits } from "./entitlement/rate-limit";
import { reconcileClaimable } from "./entitlement/reconcile";
import type { SqlExecutor } from "./entitlement/sql";
import { consumeAuthNonce } from "./entitlement/store";
import { entitlementTransportAllowed, transportModeFromEnv } from "./entitlement/transport";

const GUEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const OTHER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const WORKER_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex;

const ROOM = "0x2222222222222222222222222222222222222222" as Address;
const DOMAIN = "hotel.test";
const DEV_URL = "http://127.0.0.1:3000/api/entitlement/challenge";
const PROD_URL = "https://hotel.test/api/entitlement";

const guest = privateKeyToAccount(GUEST_KEY);
const signer = privateKeyToAccount(SIGNER_KEY);
const other = privateKeyToAccount(OTHER_KEY);
const worker = privateKeyToAccount(WORKER_KEY);
const GUEST = normalizeAddress(guest.address);
const SIGNER = normalizeAddress(signer.address);

let db: PGlite;
let now = new Date("2026-06-01T00:00:00.000Z");
let claimed = 0n;
let epoch = 1n;
let onchainSigner = SIGNER;
let signCalls = 0;

function asSql(database: PGlite): SqlExecutor {
  return {
    query: (sql, params) => database.query(sql, params),
  };
}

function deps(overrides: Partial<EntitlementDeps> = {}): EntitlementDeps {
  return {
    sql: asSql(db),
    now: () => now,
    domain: DOMAIN,
    roomServiceAddress: ROOM,
    entitlementSignerAddress: SIGNER,
    entitlementSignerPrivateKey: SIGNER_KEY,
    chain: {
      roomServiceClaimed: async () => claimed,
      signerEpoch: async () => epoch,
      entitlementSigner: async () => onchainSigner,
    },
    transportMode: "development",
    rateLimits: { windowSeconds: 60, walletMax: 30, ipMax: 30 },
    signClaim: async (args) => {
      signCalls += 1;
      return signRoomServiceClaim(args);
    },
    ...overrides,
  };
}

function challengeRequest(wallet: string, url = DEV_URL, ip = "203.0.113.10"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ wallet }),
  });
}

function proofRequest(
  message: string,
  signature: string,
  url = DEV_URL,
  ip = "203.0.113.10",
): Request {
  return new Request(url.replace("/challenge", ""), {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ message, signature }),
  });
}

async function issueChallenge(wallet = GUEST, ip = "203.0.113.10") {
  const response = await handleCreateChallenge(challengeRequest(wallet, DEV_URL, ip), deps());
  const body = (await response.json()) as {
    wallet: string;
    domain: string;
    chainId: number;
    nonce: string;
    message: string;
    issuedAt: string;
    expiresAt: string;
    error?: string;
  };
  return { response, body };
}

async function signChallenge(message: string, key: Hex = GUEST_KEY): Promise<Hex> {
  return privateKeyToAccount(key).signMessage({ message });
}

async function earned(wei: string, guestAddress = GUEST) {
  await db.query(
    `INSERT INTO guest_entitlements (guest_address, cumulative_earned_wei) VALUES ($1, $2::numeric)`,
    [guestAddress, wei],
  );
}

describe("Gate G entitlement API", () => {
  beforeAll(async () => {
    db = await applyHotelMigrations();
  }, 30_000);

  beforeEach(async () => {
    now = new Date("2026-06-01T00:00:00.000Z");
    claimed = 0n;
    epoch = 1n;
    onchainSigner = SIGNER;
    signCalls = 0;
    await db.exec(
      "TRUNCATE auth_nonces, entitlement_rate_limits, guest_entitlements, room_service_claims RESTART IDENTITY",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("binds the challenge to the requested wallet, configured domain, and chain 4663", async () => {
    const { response, body } = await issueChallenge(guest.address);
    expect(response.status).toBe(200);
    expect(body.wallet).toBe(GUEST);
    expect(body.domain).toBe(DOMAIN);
    expect(body.chainId).toBe(HOTEL_CHAIN_ID);
    expect(body.message).toContain(GUEST);
    expect(body.message).not.toContain(normalizeAddress(other.address));
    expect(body.message.startsWith(`${DOMAIN} wants you to sign in`)).toBe(true);
    expect(body.message).toContain("Chain ID: 4663");
    expect(body.message).toContain(`URI: https://${DOMAIN}`);

    const stored = await db.query<{ chain_id: number; wallet_address: string; domain: string }>(
      "SELECT chain_id, wallet_address, domain FROM auth_nonces WHERE nonce = $1",
      [body.nonce],
    );
    expect(stored.rows[0]).toEqual({ chain_id: 4663, wallet_address: GUEST, domain: DOMAIN });
  });

  it("expires a challenge after exactly 5 minutes and refuses the boundary", async () => {
    const { body } = await issueChallenge();
    expect(Date.parse(body.expiresAt) - Date.parse(body.issuedAt)).toBe(
      ENTITLEMENT_CHALLENGE_TTL_SECONDS * 1000,
    );
    const signature = await signChallenge(body.message);
    now = new Date(Date.parse(body.issuedAt) + ENTITLEMENT_CHALLENGE_TTL_SECONDS * 1000);
    const expired = await handleEntitlement(proofRequest(body.message, signature), deps());
    expect(expired.status).toBe(401);
    const row = await db.query<{ consumed_at: string | null }>(
      "SELECT consumed_at FROM auth_nonces WHERE nonce = $1",
      [body.nonce],
    );
    expect(row.rows[0]?.consumed_at ?? null).toBeNull();

    now = new Date(Date.parse(body.issuedAt) + ENTITLEMENT_CHALLENGE_TTL_SECONDS * 1000 - 1);
    await earned("10");
    claimed = 0n;
    const ok = await handleEntitlement(proofRequest(body.message, signature), deps());
    expect(ok.status).toBe(200);
  });

  it("consumes a challenge once and rejects a second presentation", async () => {
    await earned("10");
    const { body } = await issueChallenge();
    const signature = await signChallenge(body.message);
    const first = await handleEntitlement(proofRequest(body.message, signature), deps());
    const second = await handleEntitlement(proofRequest(body.message, signature), deps());
    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
    expect(signCalls).toBe(1);
    const row = await db.query<{ consumed_at: string | null }>(
      "SELECT consumed_at FROM auth_nonces WHERE nonce = $1",
      [body.nonce],
    );
    expect(row.rows[0]?.consumed_at).toBeTruthy();
  });

  it("lets only one concurrent request consume a nonce", async () => {
    await earned("10");
    const { body } = await issueChallenge();
    const signature = await signChallenge(body.message);
    const [left, right] = await Promise.all([
      handleEntitlement(proofRequest(body.message, signature, DEV_URL, "203.0.113.21"), deps()),
      handleEntitlement(proofRequest(body.message, signature, DEV_URL, "203.0.113.22"), deps()),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([200, 401]);
    expect(signCalls).toBe(1);
    const direct = await Promise.all([
      consumeAuthNonce(asSql(db), { nonce: body.nonce, wallet: GUEST, domain: DOMAIN, now }),
      consumeAuthNonce(asSql(db), { nonce: body.nonce, wallet: GUEST, domain: DOMAIN, now }),
    ]);
    expect(direct).toEqual([false, false]);
  });

  it("does not consume the attempted or unrelated challenge on invalid, wrong-wallet, wrong-domain, or wrong-chain proofs", async () => {
    const first = await issueChallenge();
    const second = await issueChallenge(GUEST, "203.0.113.40");
    const valid = await signChallenge(first.body.message);

    const invalidSig = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}` as Hex;
    expect(
      (await handleEntitlement(proofRequest(first.body.message, invalidSig), deps())).status,
    ).toBe(401);

    expect(
      (
        await handleEntitlement(
          proofRequest(first.body.message, await signChallenge(first.body.message, OTHER_KEY)),
          deps(),
        )
      ).status,
    ).toBe(401);

    const wrongDomain = first.body.message.replaceAll(DOMAIN, "evil.test");
    expect(
      (await handleEntitlement(proofRequest(wrongDomain, await signChallenge(wrongDomain)), deps()))
        .status,
    ).toBe(401);

    const wrongChain = first.body.message.replace("Chain ID: 4663", "Chain ID: 1");
    expect(
      (await handleEntitlement(proofRequest(wrongChain, await signChallenge(wrongChain)), deps()))
        .status,
    ).toBe(401);

    const rows = await db.query<{ nonce: string; consumed_at: string | null }>(
      "SELECT nonce, consumed_at FROM auth_nonces ORDER BY created_at",
    );
    expect(rows.rows.every((row) => row.consumed_at === null)).toBe(true);
    expect(rows.rows.map((row) => row.nonce)).toEqual([first.body.nonce, second.body.nonce]);

    await earned("4");
    const recovered = await handleEntitlement(
      proofRequest(second.body.message, await signChallenge(second.body.message)),
      deps(),
    );
    expect(recovered.status).toBe(200);
    const leftover = await db.query<{ consumed_at: string | null }>(
      "SELECT consumed_at FROM auth_nonces WHERE nonce = $1",
      [first.body.nonce],
    );
    expect(leftover.rows[0]?.consumed_at ?? null).toBeNull();
  });

  it("rejects production HTTP, including localhost, and allows development localhost only", async () => {
    expect(transportModeFromEnv("production")).toBe("production");
    expect(transportModeFromEnv("test")).toBe("development");
    expect(
      entitlementTransportAllowed({ mode: "production", protocol: "http", hostname: "127.0.0.1" }),
    ).toBe(false);
    expect(
      entitlementTransportAllowed({ mode: "development", protocol: "http", hostname: "127.0.0.1" }),
    ).toBe(true);
    expect(
      entitlementTransportAllowed({
        mode: "development",
        protocol: "http",
        hostname: "hotel.test",
      }),
    ).toBe(false);

    const productionHttp = await handleCreateChallenge(
      challengeRequest(GUEST, "http://127.0.0.1/api/entitlement/challenge"),
      deps({ transportMode: "production" }),
    );
    expect(productionHttp.status).toBe(403);
    expect(((await productionHttp.json()) as { error: string }).error).toBe("https_required");

    const forwardedHttp = await handleCreateChallenge(
      new Request(PROD_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-proto": "http" },
        body: JSON.stringify({ wallet: GUEST }),
      }),
      deps({ transportMode: "production" }),
    );
    expect(forwardedHttp.status).toBe(403);

    const remoteDev = await handleCreateChallenge(
      challengeRequest(GUEST, "http://hotel.test/api/entitlement/challenge"),
      deps({ transportMode: "development" }),
    );
    expect(remoteDev.status).toBe(403);

    const localDev = await handleCreateChallenge(challengeRequest(GUEST), deps());
    expect(localDev.status).toBe(200);

    const productionHttps = await handleCreateChallenge(
      challengeRequest(GUEST, "https://hotel.test/api/entitlement/challenge", "203.0.113.77"),
      deps({ transportMode: "production" }),
    );
    expect(productionHttps.status).toBe(200);
    expect((await db.query("SELECT count(*)::int AS c FROM auth_nonces")).rows[0]).toEqual({
      c: 2,
    });
  });

  it("sets private no-store cache headers on the authenticated entitlement response", async () => {
    await earned("10");
    const { body } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(body.message, await signChallenge(body.message)),
      deps(),
    );
    const cache = response.headers.get("cache-control") ?? "";
    expect(cache).toContain("private");
    expect(cache).toContain("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
  });

  it("rate limits by wallet and by IP separately", async () => {
    const tight = deps({ rateLimits: { windowSeconds: 60, walletMax: 2, ipMax: 2 } });
    const walletA = await handleCreateChallenge(
      challengeRequest(GUEST, DEV_URL, "198.51.100.1"),
      tight,
    );
    const walletB = await handleCreateChallenge(
      challengeRequest(GUEST, DEV_URL, "198.51.100.2"),
      tight,
    );
    const walletC = await handleCreateChallenge(
      challengeRequest(GUEST, DEV_URL, "198.51.100.3"),
      tight,
    );
    expect(walletA.status).toBe(200);
    expect(walletB.status).toBe(200);
    expect(walletC.status).toBe(429);
    expect(((await walletC.json()) as { scope: string }).scope).toBe("wallet");

    await db.exec("TRUNCATE entitlement_rate_limits");
    const otherWallet = normalizeAddress(other.address);
    const thirdWallet = normalizeAddress(worker.address);
    const ipA = await handleCreateChallenge(
      challengeRequest(GUEST, DEV_URL, "198.51.100.9"),
      tight,
    );
    const ipB = await handleCreateChallenge(
      challengeRequest(otherWallet, DEV_URL, "198.51.100.9"),
      tight,
    );
    const ipC = await handleCreateChallenge(
      challengeRequest(thirdWallet, DEV_URL, "198.51.100.9"),
      tight,
    );
    expect(ipA.status).toBe(200);
    expect(ipB.status).toBe(200);
    expect(ipC.status).toBe(429);
    expect(((await ipC.json()) as { scope: string }).scope).toBe("ip");
    expect(defaultRateLimits()).toEqual({ windowSeconds: 60, walletMax: 30, ipMax: 120 });
  });

  it("signs only finalized cumulative earnings, reconciles onchain claimed, and uses the current epoch", async () => {
    await earned("1000");
    await db.query(
      `INSERT INTO room_service_claims (guest_address, cumulative_entitlement_wei, payout_wei, signer_epoch)
       VALUES ($1, 200, 200, 1)`,
      [GUEST],
    );
    claimed = 250n;
    epoch = 4n;
    const { body: challenge } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(challenge.message, await signChallenge(challenge.message)),
      deps(),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      cumulativeFinalizedEarnedWei: string;
      alreadyClaimedWei: string;
      claimableDeltaWei: string;
      signerEpoch: string;
      deadline: string;
      signature: string;
      verifyingContract: string;
    };
    expect(body.cumulativeFinalizedEarnedWei).toBe("1000");
    expect(body.alreadyClaimedWei).toBe("250");
    expect(body.claimableDeltaWei).toBe("750");
    expect(body.signerEpoch).toBe("4");
    expect(body.verifyingContract).toBe(ROOM);
    const issuedAt = Math.floor(now.getTime() / 1000);
    expect(body.deadline).toBe(String(issuedAt + ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS));
    expect(ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS).toBe(86_400);

    const recovered = await recoverRoomServiceClaimSigner({
      signature: body.signature as Hex,
      verifyingContract: ROOM,
      message: {
        guest: GUEST,
        cumulativeEntitlement: 1000n,
        deadline: BigInt(body.deadline),
        signerEpoch: 4n,
      },
    });
    expect(recovered).toBe(SIGNER);
    const staleEpoch = await recoverRoomServiceClaimSigner({
      signature: body.signature as Hex,
      verifyingContract: ROOM,
      message: {
        guest: GUEST,
        cumulativeEntitlement: 1000n,
        deadline: BigInt(body.deadline),
        signerEpoch: 1n,
      },
    });
    expect(staleEpoch).not.toBe(SIGNER);

    const sol = readFileSync(
      new URL("../../../contracts/src/RoomService.sol", import.meta.url),
      "utf8",
    );
    expect(sol).toContain(
      `EIP712("${ROOM_SERVICE_EIP712_NAME}", "${ROOM_SERVICE_EIP712_VERSION}")`,
    );
    expect(sol).toContain(
      "RoomServiceClaim(address guest,uint256 cumulativeEntitlement,uint256 deadline,uint256 signerEpoch)",
    );
  });

  it("fails closed when onchain claimed exceeds finalized earnings and does not sign", async () => {
    await earned("40");
    claimed = 100n;
    const { body } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(body.message, await signChallenge(body.message)),
      deps(),
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: string; signature?: string };
    expect(payload.error).toBe("entitlement_inconsistent");
    expect(payload.signature).toBeUndefined();
    expect(signCalls).toBe(0);
    expect(
      reconcileClaimable({
        dbEarnedWei: 40n,
        indexedClaimCumulativeWei: 0n,
        onchainClaimedWei: 40n,
      }).claimableWei,
    ).toBe(0n);
    expect(() =>
      reconcileClaimable({
        dbEarnedWei: 40n,
        indexedClaimCumulativeWei: 0n,
        onchainClaimedWei: 41n,
      }),
    ).toThrow(EntitlementError);
  });

  it("returns unsigned status when nothing is claimable", async () => {
    await earned("50");
    claimed = 50n;
    const { body } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(body.message, await signChallenge(body.message)),
      deps(),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      signature: string | null;
      deadline: string | null;
      claimableDeltaWei: string;
    };
    expect(payload.claimableDeltaWei).toBe("0");
    expect(payload.signature).toBeNull();
    expect(payload.deadline).toBeNull();
    expect(signCalls).toBe(0);
  });

  it("refuses to sign below the configured entitlement signer or with the worker writer key", async () => {
    await expect(
      signRoomServiceClaim({
        privateKey: WORKER_KEY,
        expectedSigner: normalizeAddress(worker.address),
        forbiddenSigners: [normalizeAddress(worker.address)],
        verifyingContract: ROOM,
        message: { guest: GUEST, cumulativeEntitlement: 1n, deadline: 1n, signerEpoch: 1n },
      }),
    ).rejects.toMatchObject({
      code: "entitlement_signer_forbidden",
      message: "entitlement_signer_forbidden",
    });

    await earned("8");
    const { body } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(body.message, await signChallenge(body.message)),
      deps({ workerWriterAddress: SIGNER }),
    );
    const payload = (await response.json()) as { error: string };
    expect(response.status).toBe(503);
    expect(payload.error).toBe("entitlement_signer_forbidden");
    expect(JSON.stringify(payload)).not.toContain(SIGNER_KEY.slice(2));
    expect(signCalls).toBe(1);
  });

  it("does not log or return the entitlement signer private key", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    await earned("3");
    const { body } = await issueChallenge();
    const response = await handleEntitlement(
      proofRequest(body.message, await signChallenge(body.message)),
      deps({
        signClaim: async () => {
          throw new Error(SIGNER_KEY);
        },
      }),
    );
    const payload = await response.text();
    expect(response.status).toBe(503);
    expect(payload).not.toContain(SIGNER_KEY);
    expect(payload).not.toContain(SIGNER_KEY.slice(2));
    expect(logs.join("\n")).not.toContain(SIGNER_KEY.slice(2));
    const stored = JSON.stringify(
      (await db.query("SELECT wallet_address, nonce, domain FROM auth_nonces")).rows,
    );
    expect(stored).not.toContain(SIGNER_KEY.slice(2));
    expect(spy).toBeDefined();

    await expect(
      signRoomServiceClaim({
        privateKey: `0x${"ab".repeat(31)}` as Hex,
        expectedSigner: SIGNER,
        forbiddenSigners: [],
        verifyingContract: ROOM,
        message: { guest: GUEST, cumulativeEntitlement: 1n, deadline: 1n, signerEpoch: 1n },
      }),
    ).rejects.toMatchObject({ message: "entitlement_sign_failed" });
  });

  it("refuses an empty DATABASE_URL and has no memory-store fallback", () => {
    expect(() => requireDatabaseUrl("")).toThrow(EntitlementError);
    expect(() => requireDatabaseUrl(undefined)).toThrow(EntitlementError);
    expect(() => loadEntitlementDeps({})).toThrow(EntitlementError);
    const source = readFileSync(new URL("./entitlement/production.ts", import.meta.url), "utf8");
    expect(source).not.toContain("allowMemory");
    expect(source).not.toContain("MemoryStore");
    expect(source).toContain("no in-memory store fallback");
  });
});
