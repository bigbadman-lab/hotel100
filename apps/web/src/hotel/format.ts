import type { Address } from "@hotel100/domain";

/**
 * Approved façade geometry: 10 columns × 10 storeys.
 * Top storey holds rooms 2–10 (9 windows); the penthouse occupies the missing bay.
 * Remaining storeys hold ten windows each → 99 standard rooms (#2–#100).
 */
export const FACADE_COLUMNS = 10;
export const FACADE_ROWS = 10;
export const FACADE_TOP_ROW_COUNT = 9;
export const STANDARD_ROOM_COUNT = 99;

/** Fixed physical room numbers #2–#100, left to right, top to bottom. */
export function standardRoomNumbers(): number[] {
  return Array.from({ length: STANDARD_ROOM_COUNT }, (_, index) => index + 2);
}

/** UTC `HH:MM` from an epoch-ms timestamp. */
export function formatActivityClock(atMs: number): string {
  const d = new Date(atMs);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Relative time from a canonical activity timestamp — never a separate source. */
export function formatRelativeTime(atMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - atMs);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function isStandardRoom(room: number): boolean {
  return Number.isInteger(room) && room >= 2 && room <= 100;
}

export function shortenAddress(address: Address | string): string {
  const value = address.toLowerCase();
  if (!value.startsWith("0x") || value.length < 10) return value;
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

/** Display grouping only. Does not change raw-unit meaning. */
export function formatRawUnits(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/** ETH display from wei using integer math. Trimmed to 6 decimal places. */
export function formatEthFromWei(wei: bigint): string {
  const base = 10n ** 18n;
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
}

export function formatStayDuration(sinceMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - sinceMs) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

export function formatServiceClock(remainingSeconds: number): string {
  const safe = Math.max(0, remainingSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
