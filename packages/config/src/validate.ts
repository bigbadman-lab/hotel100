import { type Address, HOTEL_CHAIN_ID, isZeroAddress, normalizeAddress } from "@hotel100/domain";
import {
  type ConfigValidationIssue,
  type ConfigValidationResult,
  emptyHotelConfig,
  type HotelConfig,
  type ProductionWalletRoles,
  parseAddressList,
  parseOptionalAddress,
} from "./schema.js";

/**
 * Exact 3-wallet production model (§15):
 * - deployer + RoomService owner may be the same EOA (single deployerOwner field)
 * - entitlement signer MUST be distinct from deployer/owner
 * - worker writer MUST be distinct from deployer/owner AND entitlement signer
 */
export function validateProductionWallets(input: {
  deployerOwnerAddress: string;
  entitlementSignerAddress: string;
  workerWriterAddress: string;
}): { ok: true; wallets: ProductionWalletRoles } | { ok: false; issues: ConfigValidationIssue[] } {
  const issues: ConfigValidationIssue[] = [];

  let deployerOwnerAddress: Address | undefined;
  let entitlementSignerAddress: Address | undefined;
  let workerWriterAddress: Address | undefined;

  try {
    deployerOwnerAddress = normalizeAddress(input.deployerOwnerAddress);
  } catch {
    issues.push({
      code: "INVALID_ADDRESS",
      message: "Deployer/owner address is invalid",
      key: "HOTEL_DEPLOYER_OWNER_ADDRESS",
    });
  }

  try {
    entitlementSignerAddress = normalizeAddress(input.entitlementSignerAddress);
  } catch {
    issues.push({
      code: "INVALID_ADDRESS",
      message: "Entitlement signer address is invalid",
      key: "HOTEL_ENTITLEMENT_SIGNER_ADDRESS",
    });
  }

  try {
    workerWriterAddress = normalizeAddress(input.workerWriterAddress);
  } catch {
    issues.push({
      code: "INVALID_ADDRESS",
      message: "Worker writer address is invalid",
      key: "HOTEL_WORKER_WRITER_ADDRESS",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // Narrowed above
  const deployer = deployerOwnerAddress as Address;
  const signer = entitlementSignerAddress as Address;
  const writer = workerWriterAddress as Address;

  if (isZeroAddress(deployer) || isZeroAddress(signer) || isZeroAddress(writer)) {
    issues.push({
      code: "ZERO_ADDRESS",
      message: "Production wallet roles cannot be the zero address",
    });
  }

  if (signer === deployer) {
    issues.push({
      code: "ROLE_COLLISION",
      message: "Entitlement signer must be distinct from deployer/owner",
      key: "HOTEL_ENTITLEMENT_SIGNER_ADDRESS",
    });
  }

  if (writer === deployer) {
    issues.push({
      code: "ROLE_COLLISION",
      message: "Worker writer must be distinct from deployer/owner",
      key: "HOTEL_WORKER_WRITER_ADDRESS",
    });
  }

  if (writer === signer) {
    issues.push({
      code: "ROLE_COLLISION",
      message: "Worker writer must be distinct from entitlement signer",
      key: "HOTEL_WORKER_WRITER_ADDRESS",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    wallets: {
      deployerOwnerAddress: deployer,
      entitlementSignerAddress: signer,
      workerWriterAddress: writer,
    },
  };
}

/**
 * Validate a production-bound config object.
 * Does not invent missing values — reports them as issues.
 */
export function validateProductionConfig(config: HotelConfig): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (config.chainId !== HOTEL_CHAIN_ID) {
    issues.push({
      code: "WRONG_CHAIN",
      message: `Runtime chain ID must be ${HOTEL_CHAIN_ID}`,
      key: "chainId",
    });
  }

  if (config.ponsBuybackEnabled !== false) {
    issues.push({
      code: "BUYBACK_MUST_BE_OFF",
      message: "Pons buyback must be OFF for HOTEL V1",
    });
  }

  if (config.ponsCreatorTaxBps !== 300) {
    issues.push({
      code: "WRONG_CREATOR_TAX",
      message: "Creator tax must be 300 bps for HOTEL V1",
    });
  }

  const requiredKeys: Array<{ key: keyof HotelConfig; env: string }> = [
    { key: "rpcUrl", env: "HOTEL_RPC_URL" },
    { key: "domain", env: "HOTEL_DOMAIN" },
    { key: "tokenAddress", env: "HOTEL_TOKEN_ADDRESS" },
    { key: "ponsFeeEscrowAddress", env: "PONS_FEE_ESCROW_ADDRESS" },
    { key: "hoodLockAddress", env: "HOODLOCK_ADDRESS" },
    { key: "roomServiceAddress", env: "ROOMSERVICE_ADDRESS" },
    { key: "deployerOwnerAddress", env: "HOTEL_DEPLOYER_OWNER_ADDRESS" },
    { key: "entitlementSignerAddress", env: "HOTEL_ENTITLEMENT_SIGNER_ADDRESS" },
    { key: "workerWriterAddress", env: "HOTEL_WORKER_WRITER_ADDRESS" },
    { key: "supabaseUrl", env: "SUPABASE_URL" },
    { key: "databaseUrl", env: "DATABASE_URL" },
    { key: "hotelLaunchBlock", env: "HOTEL_LAUNCH_BLOCK" },
    { key: "hotelOpenBlock", env: "HOTEL_OPEN_BLOCK" },
    { key: "hotelOpenTimestamp", env: "HOTEL_OPEN_TIMESTAMP" },
  ];

  for (const { key, env } of requiredKeys) {
    const value = config[key];
    if (value === undefined || value === null || value === "") {
      issues.push({
        code: "UNRESOLVED_INPUT",
        message: `${env} is unresolved`,
        key: env,
      });
    }
  }

  if (
    config.deployerOwnerAddress &&
    config.entitlementSignerAddress &&
    config.workerWriterAddress
  ) {
    const wallets = validateProductionWallets({
      deployerOwnerAddress: config.deployerOwnerAddress,
      entitlementSignerAddress: config.entitlementSignerAddress,
      workerWriterAddress: config.workerWriterAddress,
    });
    if (!wallets.ok) {
      issues.push(...wallets.issues);
    } else if (issues.length === 0) {
      return { ok: true, config, wallets: wallets.wallets };
    }
  }

  return { ok: false, issues };
}

/**
 * Build config from an env-like record (key names only; values may be empty).
 * Does not invent missing production values.
 */
export function hotelConfigFromEnv(env: Record<string, string | undefined>): HotelConfig {
  const base = emptyHotelConfig();

  const hotelLiveRaw = env.HOTEL_LIVE;
  const hotelLive =
    hotelLiveRaw === undefined || hotelLiveRaw === ""
      ? base.hotelLive
      : hotelLiveRaw === "true" || hotelLiveRaw === "1";

  const chainIdRaw = env.HOTEL_CHAIN_ID;
  const chainId =
    chainIdRaw === undefined || chainIdRaw === "" ? HOTEL_CHAIN_ID : Number(chainIdRaw);

  if (chainId !== HOTEL_CHAIN_ID) {
    throw new Error(`HOTEL_CHAIN_ID must be ${HOTEL_CHAIN_ID}`);
  }

  return {
    ...base,
    hotelLive,
    chainId: HOTEL_CHAIN_ID,
    rpcUrl: emptyToUndefined(env.HOTEL_RPC_URL),
    domain: emptyToUndefined(env.HOTEL_DOMAIN),
    brandName: emptyToUndefined(env.HOTEL_BRAND_NAME),
    tokenName: emptyToUndefined(env.HOTEL_TOKEN_NAME),
    tokenSymbol: emptyToUndefined(env.HOTEL_TOKEN_SYMBOL),
    tokenAddress: parseOptionalAddress(env.HOTEL_TOKEN_ADDRESS, "HOTEL_TOKEN_ADDRESS"),
    ponsV2FactoryAddress: parseOptionalAddress(
      env.PONS_V2_FACTORY_ADDRESS,
      "PONS_V2_FACTORY_ADDRESS",
    ),
    ponsV2RouterAddress: parseOptionalAddress(env.PONS_V2_ROUTER_ADDRESS, "PONS_V2_ROUTER_ADDRESS"),
    ponsFeeEscrowAddress: parseOptionalAddress(
      env.PONS_FEE_ESCROW_ADDRESS,
      "PONS_FEE_ESCROW_ADDRESS",
    ),
    ponsLaunchSalt: emptyToUndefined(env.PONS_LAUNCH_SALT),
    hoodLockAddress: parseOptionalAddress(env.HOODLOCK_ADDRESS, "HOODLOCK_ADDRESS"),
    roomServiceAddress: parseOptionalAddress(env.ROOMSERVICE_ADDRESS, "ROOMSERVICE_ADDRESS"),
    deployerOwnerAddress: parseOptionalAddress(
      env.HOTEL_DEPLOYER_OWNER_ADDRESS,
      "HOTEL_DEPLOYER_OWNER_ADDRESS",
    ),
    entitlementSignerAddress: parseOptionalAddress(
      env.HOTEL_ENTITLEMENT_SIGNER_ADDRESS,
      "HOTEL_ENTITLEMENT_SIGNER_ADDRESS",
    ),
    workerWriterAddress: parseOptionalAddress(
      env.HOTEL_WORKER_WRITER_ADDRESS,
      "HOTEL_WORKER_WRITER_ADDRESS",
    ),
    supabaseUrl: emptyToUndefined(env.SUPABASE_URL),
    supabaseAnonKey: emptyToUndefined(env.SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: emptyToUndefined(env.SUPABASE_SERVICE_ROLE_KEY),
    databaseUrl: emptyToUndefined(env.DATABASE_URL),
    hotelLaunchBlock: parseOptionalBigInt(env.HOTEL_LAUNCH_BLOCK),
    hotelOpenBlock: parseOptionalBigInt(env.HOTEL_OPEN_BLOCK),
    hotelOpenTimestamp: parseOptionalInt(env.HOTEL_OPEN_TIMESTAMP),
    manualExclusions: parseAddressList(env.HOTEL_MANUAL_EXCLUSIONS),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseOptionalBigInt(value: string | undefined): bigint | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined) return undefined;
  return BigInt(v);
}

function parseOptionalInt(value: string | undefined): number | undefined {
  const v = emptyToUndefined(value);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Expected non-negative integer, got ${value}`);
  }
  return n;
}
