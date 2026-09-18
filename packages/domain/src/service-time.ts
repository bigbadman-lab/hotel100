import { ROOM_SERVICE_INTERVAL_SECONDS } from "./constants.js";

/**
 * Service number = floor(boundaryTimestamp / 900)
 * Boundaries are UTC unix seconds aligned to 900s.
 */
export function serviceNumberAtBoundary(boundaryTimestampSeconds: number): number {
  assertUnixSeconds(boundaryTimestampSeconds, "boundaryTimestampSeconds");
  return Math.floor(boundaryTimestampSeconds / ROOM_SERVICE_INTERVAL_SECONDS);
}

export function boundaryTimestampForServiceNumber(serviceNumber: number): number {
  if (!Number.isInteger(serviceNumber) || serviceNumber < 0) {
    throw new Error("serviceNumber must be a non-negative integer");
  }
  return serviceNumber * ROOM_SERVICE_INTERVAL_SECONDS;
}

/** Greatest boundary timestamp ≤ timestamp (may equal timestamp if exact). */
export function floorServiceBoundary(timestampSeconds: number): number {
  assertUnixSeconds(timestampSeconds, "timestampSeconds");
  return (
    Math.floor(timestampSeconds / ROOM_SERVICE_INTERVAL_SECONDS) * ROOM_SERVICE_INTERVAL_SECONDS
  );
}

/** Smallest boundary timestamp strictly greater than timestamp. */
export function nextServiceBoundaryStrictlyAfter(timestampSeconds: number): number {
  assertUnixSeconds(timestampSeconds, "timestampSeconds");
  return floorServiceBoundary(timestampSeconds) + ROOM_SERVICE_INTERVAL_SECONDS;
}

/**
 * First Room Service boundary: first UTC 15-minute boundary
 * strictly after HOTEL_OPEN_TIMESTAMP (§6).
 */
export function firstServiceBoundaryAfterOpen(hotelOpenTimestampSeconds: number): number {
  return nextServiceBoundaryStrictlyAfter(hotelOpenTimestampSeconds);
}

export function firstServiceNumberAfterOpen(hotelOpenTimestampSeconds: number): number {
  return serviceNumberAtBoundary(firstServiceBoundaryAfterOpen(hotelOpenTimestampSeconds));
}

export function isExactServiceBoundary(timestampSeconds: number): boolean {
  assertUnixSeconds(timestampSeconds, "timestampSeconds");
  return timestampSeconds % ROOM_SERVICE_INTERVAL_SECONDS === 0;
}

function assertUnixSeconds(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative unix-second integer`);
  }
}
