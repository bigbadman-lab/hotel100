/**
 * Public / operational HOTEL status values needed by later gates.
 * Strings match frozen UX copy where specified.
 */

/** Pre-live website state when HOTEL_LIVE=false */
export const PUBLIC_STATUS = {
  CHECK_IN_OPENS_SOON: "HOTEL CHECK-IN OPENS SOON",
  SYNCING: "HOTEL SYNCING",
  ROOM_SERVICE_DELAYED: "ROOM SERVICE DELAYED",
  ROOM_SERVICE_ARRIVING: "ROOM SERVICE ARRIVING",
  VACANT: "VACANT",
  NOT_CHECKED_IN: "NOT CHECKED IN",
} as const;

export type PublicStatusMessage = (typeof PUBLIC_STATUS)[keyof typeof PUBLIC_STATUS];

/** Post-live canary / MVP state machine (§27) */
export const LIVE_CANARY_STATUS = {
  CANARY_PENDING: "LIVE — CANARY PENDING",
  MVP_LIVE: "PASS — MVP LIVE",
} as const;

export type LiveCanaryStatus = (typeof LIVE_CANARY_STATUS)[keyof typeof LIVE_CANARY_STATUS];

/** Worker / financial operational states */
export const OPERATIONAL_STATUS = {
  OK: "OK",
  ROOM_SERVICE_DELAYED: "ROOM SERVICE DELAYED",
  STUCK: "STUCK",
  INDEXING_GAP: "INDEXING_GAP",
  SYNCING: "HOTEL SYNCING",
} as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUS)[keyof typeof OPERATIONAL_STATUS];

export type HotelLiveFlag = boolean;

/**
 * Derive public sync presentation from indexer freshness.
 * Stale > 30 seconds ⇒ HOTEL SYNCING (must not serve old rooms as current).
 */
export function isPublicStateStale(
  lastIndexedAtMs: number,
  nowMs: number,
  staleThresholdMs: number,
): boolean {
  if (!Number.isFinite(lastIndexedAtMs) || !Number.isFinite(nowMs)) {
    return true;
  }
  return nowMs - lastIndexedAtMs > staleThresholdMs;
}

export function publicStatusWhenStale(): typeof PUBLIC_STATUS.SYNCING {
  return PUBLIC_STATUS.SYNCING;
}

/** Initial status immediately after live activation, before canary proof */
export function initialPostLiveCanaryStatus(): typeof LIVE_CANARY_STATUS.CANARY_PENDING {
  return LIVE_CANARY_STATUS.CANARY_PENDING;
}
