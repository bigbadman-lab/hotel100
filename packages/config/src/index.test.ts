import { describe, expect, it } from "vitest";
import {
  emptyHotelConfig,
  hotelConfigFromEnv,
  validateEligibilitySigner,
  validateProductionConfig,
  validateProductionWallets,
} from "./index.js";

/** Fixture addresses only — not production values */
const DEPLOYER = "0x0000000000000000000000000000000000000001";
const SIGNER = "0x0000000000000000000000000000000000000002";
const WRITER = "0x0000000000000000000000000000000000000003";
const OTHER = "0x0000000000000000000000000000000000000004";

describe("3-wallet production model", () => {
  it("accepts three distinct EOAs (deployer/owner same role slot)", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: DEPLOYER,
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: WRITER,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wallets.deployerOwnerAddress).toBe(DEPLOYER);
      expect(result.wallets.entitlementSignerAddress).toBe(SIGNER);
      expect(result.wallets.workerWriterAddress).toBe(WRITER);
    }
  });

  it("normalizes mixed-case wallet addresses", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: "0x000000000000000000000000000000000000000A",
      entitlementSignerAddress: "0x000000000000000000000000000000000000000B",
      workerWriterAddress: "0x000000000000000000000000000000000000000C",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wallets.deployerOwnerAddress).toBe(
        "0x000000000000000000000000000000000000000a",
      );
    }
  });

  it("BLOCKED when entitlement signer equals deployer/owner", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: DEPLOYER,
      entitlementSignerAddress: DEPLOYER,
      workerWriterAddress: WRITER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "ROLE_COLLISION")).toBe(true);
    }
  });

  it("BLOCKED when worker writer equals deployer/owner", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: DEPLOYER,
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: DEPLOYER,
    });
    expect(result.ok).toBe(false);
  });

  it("BLOCKED when worker writer equals entitlement signer", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: DEPLOYER,
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: SIGNER,
    });
    expect(result.ok).toBe(false);
  });

  it("BLOCKED on zero address roles", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: "0x0000000000000000000000000000000000000000",
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: WRITER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "ZERO_ADDRESS")).toBe(true);
    }
  });

  it("BLOCKED on invalid address shapes", () => {
    const result = validateProductionWallets({
      deployerOwnerAddress: "nope",
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: WRITER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "INVALID_ADDRESS")).toBe(true);
    }
  });
});

describe("production config validation", () => {
  it("reports unresolved inputs without inventing them", () => {
    const result = validateProductionConfig(emptyHotelConfig());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "UNRESOLVED_INPUT")).toBe(true);
      expect(result.issues.some((i) => i.key === "HOTEL_DEPLOYER_OWNER_ADDRESS")).toBe(true);
    }
  });

  it("passes when all required fields and distinct wallets are set (fixtures)", () => {
    const config = emptyHotelConfig();
    config.rpcUrl = "https://example.invalid/rpc";
    config.domain = "hotel.example";
    config.tokenAddress = OTHER;
    config.ponsFeeEscrowAddress = OTHER;
    config.hoodLockAddress = OTHER;
    config.roomServiceAddress = OTHER;
    config.deployerOwnerAddress = DEPLOYER;
    config.entitlementSignerAddress = SIGNER;
    config.workerWriterAddress = WRITER;
    config.supabaseUrl = "https://example.supabase.co";
    config.databaseUrl = "postgresql://local/hotel";
    config.hotelLaunchBlock = 1n;
    config.hotelOpenBlock = 2n;
    config.hotelOpenTimestamp = 1_700_000_000;

    const result = validateProductionConfig(config);
    expect(result.ok).toBe(true);
  });

  it("rejects wrong chain id", () => {
    const config = emptyHotelConfig();
    // @ts-expect-error intentional invalid chain for test
    config.chainId = 1;
    const result = validateProductionConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "WRONG_CHAIN")).toBe(true);
    }
  });
});

describe("hotelConfigFromEnv", () => {
  it("leaves unresolved keys undefined rather than inventing addresses", () => {
    const config = hotelConfigFromEnv({
      HOTEL_LIVE: "false",
      HOTEL_CHAIN_ID: "4663",
    });
    expect(config.tokenAddress).toBeUndefined();
    expect(config.deployerOwnerAddress).toBeUndefined();
    expect(config.rpcUrl).toBeUndefined();
    expect(config.hotelLive).toBe(false);
    expect(config.hotelCheckInEnabled).toBe(false);
    expect(config.chainId).toBe(4663);
  });

  it("parses HOTEL_CHECKIN_ENABLED and eligibility signer", () => {
    const config = hotelConfigFromEnv({
      HOTEL_CHECKIN_ENABLED: "true",
      HOTEL_ELIGIBILITY_SIGNER_ADDRESS: OTHER,
    });
    expect(config.hotelCheckInEnabled).toBe(true);
    expect(config.eligibilitySignerAddress).toBe(OTHER);
  });

  it("parses manual exclusions as lowercase addresses", () => {
    const config = hotelConfigFromEnv({
      HOTEL_MANUAL_EXCLUSIONS:
        "0x00000000000000000000000000000000000000Aa,0x00000000000000000000000000000000000000Bb",
    });
    expect(config.manualExclusions).toEqual([
      "0x00000000000000000000000000000000000000aa",
      "0x00000000000000000000000000000000000000bb",
    ]);
  });

  it("rejects non-4663 chain id from env", () => {
    expect(() => hotelConfigFromEnv({ HOTEL_CHAIN_ID: "1" })).toThrow(/4663/);
  });
});

describe("eligibility signer", () => {
  const ELIG = "0x0000000000000000000000000000000000000005";

  it("accepts a distinct eligibility signer", () => {
    const result = validateEligibilitySigner({
      eligibilitySignerAddress: ELIG,
      deployerOwnerAddress: DEPLOYER,
      entitlementSignerAddress: SIGNER,
      workerWriterAddress: WRITER,
    });
    expect(result.ok).toBe(true);
  });

  it("BLOCKED when eligibility equals entitlement signer", () => {
    const result = validateEligibilitySigner({
      eligibilitySignerAddress: SIGNER,
      entitlementSignerAddress: SIGNER,
    });
    expect(result.ok).toBe(false);
  });

  it("requires eligibility signer when check-in enabled", () => {
    const config = emptyHotelConfig();
    config.hotelCheckInEnabled = true;
    config.rpcUrl = "https://example.invalid/rpc";
    config.domain = "hotel.example";
    config.tokenAddress = OTHER;
    config.ponsFeeEscrowAddress = OTHER;
    config.hoodLockAddress = OTHER;
    config.roomServiceAddress = OTHER;
    config.deployerOwnerAddress = DEPLOYER;
    config.entitlementSignerAddress = SIGNER;
    config.workerWriterAddress = WRITER;
    config.supabaseUrl = "https://example.supabase.co";
    config.databaseUrl = "postgresql://local/hotel";
    config.hotelLaunchBlock = 1n;
    config.hotelOpenBlock = 2n;
    config.hotelOpenTimestamp = 1_700_000_000;
    const result = validateProductionConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.key === "HOTEL_ELIGIBILITY_SIGNER_ADDRESS")).toBe(true);
    }
  });
});
