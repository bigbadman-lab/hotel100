import {
  type Address,
  HOODLOCK_MIN_DURATION_SECONDS,
  HOODLOCK_PRODUCTION_BUFFER_SECONDS,
  HOTEL_CHAIN_ID,
  normalizeAddress,
  PONS_BUYBACK_ENABLED,
  PONS_CREATOR_TAX_BPS,
  PONS_OPENING_BUY_ETH,
  PONS_OPENING_BUY_MAX_SLIPPAGE_BPS,
} from "@hotel100/domain";

/** Default live flag — production activation is a later gate */
export const HOTEL_LIVE_DEFAULT = false as const;

/** Check-in feature flag — production enablement is a later gate */
export const HOTEL_CHECKIN_ENABLED_DEFAULT = false as const;

/**
 * Keys that may remain unresolved until later (§28).
 * Do not invent values for these in production config.
 */
export type HotelUnresolvedConfigKeys =
  | "HOTEL_RPC_URL"
  | "HOTEL_DOMAIN"
  | "HOTEL_BRAND_NAME"
  | "HOTEL_TOKEN_NAME"
  | "HOTEL_TOKEN_SYMBOL"
  | "HOTEL_TOKEN_ADDRESS"
  | "PONS_V2_FACTORY_ADDRESS"
  | "PONS_V2_ROUTER_ADDRESS"
  | "PONS_FEE_ESCROW_ADDRESS"
  | "PONS_LAUNCH_SALT"
  | "HOODLOCK_ADDRESS"
  | "ROOMSERVICE_ADDRESS"
  | "HOTEL_DEPLOYER_OWNER_ADDRESS"
  | "HOTEL_ENTITLEMENT_SIGNER_ADDRESS"
  | "HOTEL_ELIGIBILITY_SIGNER_ADDRESS"
  | "HOTEL_WORKER_WRITER_ADDRESS"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "DATABASE_URL"
  | "HOTEL_LAUNCH_BLOCK"
  | "HOTEL_OPEN_BLOCK"
  | "HOTEL_OPEN_TIMESTAMP"
  | "HOTEL_MANUAL_EXCLUSIONS";

/**
 * Typed HOTEL config schema.
 * Optional fields are intentionally unresolved production inputs.
 */
export type HotelConfig = {
  chainId: typeof HOTEL_CHAIN_ID;
  hotelLive: boolean;
  /** When false, check-in authorize API refuses. Default false — do not enable in production yet. */
  hotelCheckInEnabled: boolean;

  /** Unresolved until set — never invent */
  rpcUrl?: string;
  domain?: string;
  brandName?: string;

  tokenName?: string;
  tokenSymbol?: string;
  tokenAddress?: Address;

  ponsV2FactoryAddress?: Address;
  ponsV2RouterAddress?: Address;
  ponsFeeEscrowAddress?: Address;
  ponsLaunchSalt?: string;
  ponsCreatorTaxBps: typeof PONS_CREATOR_TAX_BPS;
  ponsBuybackEnabled: typeof PONS_BUYBACK_ENABLED;
  ponsOpeningBuyEth: typeof PONS_OPENING_BUY_ETH;
  ponsOpeningBuyMaxSlippageBps: typeof PONS_OPENING_BUY_MAX_SLIPPAGE_BPS;

  hoodLockAddress?: Address;
  hoodLockMinDurationSeconds: typeof HOODLOCK_MIN_DURATION_SECONDS;
  hoodLockProductionBufferSeconds: typeof HOODLOCK_PRODUCTION_BUFFER_SECONDS;

  roomServiceAddress?: Address;

  /**
   * Production wallet roles.
   * V1 launch used three EOAs; check-in adds an optional eligibility signer
   * (distinct from entitlement signer). Required when hotelCheckInEnabled.
   */
  deployerOwnerAddress?: Address;
  entitlementSignerAddress?: Address;
  /** Check-in EIP-712 signer — never reuse the entitlement signer key. */
  eligibilitySignerAddress?: Address;
  workerWriterAddress?: Address;

  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  databaseUrl?: string;

  hotelLaunchBlock?: bigint;
  hotelOpenBlock?: bigint;
  /** Unix seconds UTC */
  hotelOpenTimestamp?: number;

  /** Lowercase normalized exclusion list */
  manualExclusions: Address[];
};

export type ProductionWalletRoles = {
  deployerOwnerAddress: Address;
  entitlementSignerAddress: Address;
  workerWriterAddress: Address;
};

export type ConfigValidationIssue = {
  code: string;
  message: string;
  key?: HotelUnresolvedConfigKeys | string;
};

export type ConfigValidationResult =
  | { ok: true; config: HotelConfig; wallets: ProductionWalletRoles }
  | { ok: false; issues: ConfigValidationIssue[] };

/** Frozen defaults that must not be overridden by env in ways that break the MVP */
export function frozenConfigDefaults(): Pick<
  HotelConfig,
  | "chainId"
  | "hotelLive"
  | "hotelCheckInEnabled"
  | "ponsCreatorTaxBps"
  | "ponsBuybackEnabled"
  | "ponsOpeningBuyEth"
  | "ponsOpeningBuyMaxSlippageBps"
  | "hoodLockMinDurationSeconds"
  | "hoodLockProductionBufferSeconds"
  | "manualExclusions"
> {
  return {
    chainId: HOTEL_CHAIN_ID,
    hotelLive: HOTEL_LIVE_DEFAULT,
    hotelCheckInEnabled: HOTEL_CHECKIN_ENABLED_DEFAULT,
    ponsCreatorTaxBps: PONS_CREATOR_TAX_BPS,
    ponsBuybackEnabled: PONS_BUYBACK_ENABLED,
    ponsOpeningBuyEth: PONS_OPENING_BUY_ETH,
    ponsOpeningBuyMaxSlippageBps: PONS_OPENING_BUY_MAX_SLIPPAGE_BPS,
    hoodLockMinDurationSeconds: HOODLOCK_MIN_DURATION_SECONDS,
    hoodLockProductionBufferSeconds: HOODLOCK_PRODUCTION_BUFFER_SECONDS,
    manualExclusions: [],
  };
}

export function emptyHotelConfig(): HotelConfig {
  return { ...frozenConfigDefaults() };
}

/** Parse optional address; empty / undefined stays unresolved */
export function parseOptionalAddress(
  value: string | undefined | null,
  key: string,
): Address | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  try {
    return normalizeAddress(trimmed);
  } catch {
    throw new Error(`Invalid address for ${key}`);
  }
}

export function parseAddressList(csv: string | undefined | null): Address[] {
  if (!csv || csv.trim() === "") return [];
  return csv
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => normalizeAddress(part));
}
