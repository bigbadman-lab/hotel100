/**
 * HOTEL config schema + production validation — Gate B+.
 * Bootstrap placeholder: unresolved production values must stay configurable.
 */
export type HotelUnresolvedConfigKeys =
  | "HOTEL_RPC_URL"
  | "HOTEL_DOMAIN"
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
  | "HOTEL_WORKER_WRITER_ADDRESS"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "DATABASE_URL"
  | "HOTEL_LAUNCH_BLOCK"
  | "HOTEL_OPEN_BLOCK"
  | "HOTEL_OPEN_TIMESTAMP"
  | "HOTEL_MANUAL_EXCLUSIONS";

export const HOTEL_LIVE_DEFAULT = false as const;
