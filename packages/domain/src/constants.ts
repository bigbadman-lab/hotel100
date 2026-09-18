/**
 * Frozen HOTEL MVP constants — do not reinterpret.
 * Unresolved production values stay in @hotel100/config as inputs.
 */

/** Robinhood Chain */
export const HOTEL_CHAIN_ID = 4663 as const;

/** Top eligible holders that occupy rooms */
export const HOTEL_ROOM_COUNT = 100 as const;

/** Rank #1 displayed name */
export const PENTHOUSE_RANK = 1 as const;

/** Lobby begins at rank 101 */
export const LOBBY_RANK_START = 101 as const;

/** Room Service interval — UTC only */
export const ROOM_SERVICE_INTERVAL_SECONDS = 900 as const;

/** Frontend live poll interval */
export const ROOM_POLL_INTERVAL_MS = 2_000 as const;

/** Indexed room/holder confirmation policy */
export const LIVE_CONFIRMATIONS = 1 as const;

/** Financial Service snapshot / finalization confirmations */
export const FINANCIAL_CONFIRMATIONS = 2 as const;

/** Collection receipt confirmation before financial read */
export const COLLECTION_CONFIRMATIONS = 1 as const;

/** Public ranking/indexer data older than this ⇒ HOTEL SYNCING */
export const PUBLIC_STALE_THRESHOLD_MS = 30_000 as const;

/** Worker approximate check cadence */
export const WORKER_POLL_INTERVAL_MS = 60_000 as const;

/** Holder reconciliation interval */
export const HOLDER_RECONCILE_INTERVAL_MS = 300_000 as const;

/** Max Services finalized per worker catch-up run */
export const SERVICE_CATCHUP_MAX = 8 as const;

/** Collection write stuck threshold (30 minutes) */
export const COLLECTION_STUCK_AFTER_MS = 1_800_000 as const;

/** Pons creator tax for HOTEL V1 */
export const PONS_CREATOR_TAX_BPS = 300 as const;

/** Pons buyback must remain off for HOTEL V1 */
export const PONS_BUYBACK_ENABLED = false as const;

/** Opening/dev buy size (ETH, as string for exact decimal config display — math uses wei elsewhere) */
export const PONS_OPENING_BUY_ETH = "0.06" as const;

export const PONS_OPENING_BUY_MAX_SLIPPAGE_BPS = 100 as const;

/** HoodLock minimum duration (7 days) */
export const HOODLOCK_MIN_DURATION_SECONDS = 604_800 as const;

/** Production unlock buffer after min duration */
export const HOODLOCK_PRODUCTION_BUFFER_SECONDS = 300 as const;

/** Entitlement SIWE-style challenge TTL */
export const ENTITLEMENT_CHALLENGE_TTL_SECONDS = 300 as const;

/** Backend EIP-712 entitlement signature validity */
export const ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS = 86_400 as const;

/** Public activity feed size */
export const PUBLIC_ACTIVITY_LIMIT = 50 as const;

/** Zero address (always excluded) */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Common burn / dead addresses (always excluded) */
export const BURN_ADDRESSES = [ZERO_ADDRESS, "0x000000000000000000000000000000000000dead"] as const;
