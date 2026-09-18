import {
  boundaryTimestampForServiceNumber,
  firstServiceNumberAfterOpen,
  floorServiceBoundary,
  SERVICE_CATCHUP_MAX,
  serviceNumberAtBoundary,
} from "@hotel100/domain";

/**
 * Services whose UTC boundary has occurred, oldest first, capped at 8.
 * Scheduling math is delegated to @hotel100/domain — not reimplemented.
 */
export function dueServiceNumbers(args: {
  hotelOpenTimestamp: number;
  nowUnixSeconds: number;
  lastFinalizedServiceNumber: number | null;
}): number[] {
  const first = firstServiceNumberAfterOpen(args.hotelOpenTimestamp);
  const latestDue = serviceNumberAtBoundary(floorServiceBoundary(args.nowUnixSeconds));
  if (latestDue < first) return [];

  const start =
    args.lastFinalizedServiceNumber === null ? first : args.lastFinalizedServiceNumber + 1;
  if (start > latestDue) return [];

  const out: number[] = [];
  for (let n = start; n <= latestDue && out.length < SERVICE_CATCHUP_MAX; n++) {
    out.push(n);
  }
  return out;
}

export function serviceBoundary(serviceNumber: number): number {
  return boundaryTimestampForServiceNumber(serviceNumber);
}

export { SERVICE_CATCHUP_MAX };
