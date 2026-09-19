import type { PGlite } from "@electric-sql/pglite";
import { applyHotelMigrations } from "@hotel100/db";
import { type Address, CHECK_IN_AUTH_VALIDITY_SECONDS, normalizeAddress } from "@hotel100/domain";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recoverCheckInAuthorizationSigner, signCheckInAuthorization } from "./check-in/eip712";
import {
  type CheckInDeps,
  handleCheckInAuthorize,
  handleCheckInChallenge,
} from "./check-in/handlers";
import type { SqlExecutor } from "./entitlement/sql";

const GUEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const ELIG_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const ENTITLEMENT_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;

const ROOM = "0x2222222222222222222222222222222222222222" as Address;
const DOMAIN = "hotel.test";
const URL = "http://127.0.0.1:3000/api/check-in/challenge";

const guest = privateKeyToAccount(GUEST_KEY);
const elig = privateKeyToAccount(ELIG_KEY);
const GUEST = normalizeAddress(guest.address);
const ELIG = normalizeAddress(elig.address);
const ENTITLEMENT = normalizeAddress(privateKeyToAccount(ENTITLEMENT_KEY).address);

let db: PGlite;
let now = new Date("2026-06-01T00:00:00.000Z");
let epoch = 1n;
let onchainSigner = ELIG;
let hasStay = false;
let code = "0x";

function asSql(database: PGlite): SqlExecutor {
  return {
    query: (sql, params) => database.query(sql, params),
  };
}

function deps(overrides: Partial<CheckInDeps> = {}): CheckInDeps {
  return {
    sql: asSql(db),
    now: () => now,
    domain: DOMAIN,
    hotelCheckInEnabled: true,
    roomServiceAddress: ROOM,
    eligibilitySignerAddress: ELIG,
    eligibilitySignerPrivateKey: ELIG_KEY,
    entitlementSignerAddress: ENTITLEMENT,
    chain: {
      eligibilitySigner: async () => onchainSigner,
      eligibilitySignerEpoch: async () => epoch,
      hasUnwithdrawnStay: async () => hasStay,
      getCode: async () => code,
    },
    transportMode: "development",
    rateLimits: { windowSeconds: 60, walletMax: 30, ipMax: 30 },
    ...overrides,
  };
}

async function seedTop100Guest(balance = "1000000"): Promise<void> {
  await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
    GUEST,
    balance,
  ]);
  for (let n = 2; n <= 100; n += 1) {
    const addr = normalizeAddress(`0x${n.toString(16).padStart(40, "0")}`);
    await db.query(`INSERT INTO holders (address, balance_raw) VALUES ($1, $2::numeric)`, [
      addr,
      String(1000000 - n),
    ]);
  }
}

beforeEach(async () => {
  db = await applyHotelMigrations();
  now = new Date("2026-06-01T00:00:00.000Z");
  epoch = 1n;
  onchainSigner = ELIG;
  hasStay = false;
  code = "0x";
});

afterEach(async () => {
  await db.close();
});

describe("check-in eligibility API", () => {
  it("issues a check-in challenge and signs a 2-minute authorization for Top 100 EOA", async () => {
    await seedTop100Guest();
    const challengeRes = await handleCheckInChallenge(
      new Request(URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ wallet: GUEST }),
      }),
      deps(),
    );
    expect(challengeRes.status).toBe(200);
    const challenge = (await challengeRes.json()) as { message: string };
    const signature = await guest.signMessage({ message: challenge.message });

    const authRes = await handleCheckInAuthorize(
      new Request(URL.replace("/challenge", "/authorize"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ message: challenge.message, signature }),
      }),
      deps(),
    );
    expect(authRes.status).toBe(200);
    const body = (await authRes.json()) as {
      minAmount: string;
      maxAmount: string;
      deadline: string;
      nonce: string;
      signerEpoch: string;
      signature: Hex;
      guest: string;
    };
    expect(body.guest).toBe(GUEST);
    expect(BigInt(body.minAmount)).toBe(100000n); // 10% of 1_000_000
    expect(BigInt(body.maxAmount)).toBe(1000000n);
    const deadline = BigInt(body.deadline);
    expect(deadline).toBe(
      BigInt(Math.floor(now.getTime() / 1000) + CHECK_IN_AUTH_VALIDITY_SECONDS),
    );

    const recovered = await recoverCheckInAuthorizationSigner({
      signature: body.signature,
      verifyingContract: ROOM,
      message: {
        guest: GUEST,
        minAmount: BigInt(body.minAmount),
        maxAmount: BigInt(body.maxAmount),
        deadline,
        nonce: BigInt(body.nonce),
        signerEpoch: BigInt(body.signerEpoch),
      },
    });
    expect(recovered).toBe(ELIG);
  });

  it("refuses when check-in feature flag is off", async () => {
    const res = await handleCheckInAuthorize(
      new Request(URL.replace("/challenge", "/authorize"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x", signature: `0x${"ab".repeat(65)}` }),
      }),
      deps({ hotelCheckInEnabled: false }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "check_in_disabled" });
  });

  it("refuses non-EOA wallets", async () => {
    await seedTop100Guest();
    code = "0x6000";
    const challengeRes = await handleCheckInChallenge(
      new Request(URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11" },
        body: JSON.stringify({ wallet: GUEST }),
      }),
      deps(),
    );
    const challenge = (await challengeRes.json()) as { message: string };
    const signature = await guest.signMessage({ message: challenge.message });
    const authRes = await handleCheckInAuthorize(
      new Request(URL.replace("/challenge", "/authorize"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11" },
        body: JSON.stringify({ message: challenge.message, signature }),
      }),
      deps(),
    );
    expect(authRes.status).toBe(403);
    expect(await authRes.json()).toEqual({ error: "not_eoa" });
  });

  it("never reuses entitlement signer as eligibility signer", async () => {
    await expect(
      signCheckInAuthorization({
        privateKey: ELIG_KEY,
        expectedSigner: ELIG,
        forbiddenSigners: [ENTITLEMENT, ELIG],
        verifyingContract: ROOM,
        message: {
          guest: GUEST,
          minAmount: 1n,
          maxAmount: 10n,
          deadline: 1n,
          nonce: 1n,
          signerEpoch: 1n,
        },
      }),
    ).rejects.toMatchObject({ code: "eligibility_signer_forbidden" });
  });
});
