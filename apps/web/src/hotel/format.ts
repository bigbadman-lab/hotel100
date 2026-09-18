import type { Address } from "@hotel100/domain";

/** 11 columns × 9 rows. Room #1 is the Penthouse, not part of this grid. */
export const FACADE_COLUMNS = 11;
export const FACADE_ROWS = 9;
export const STANDARD_ROOM_COUNT = FACADE_COLUMNS * FACADE_ROWS;

/** Fixed physical room numbers #2–#100, left to right, top to bottom. */
export function standardRoomNumbers(): number[] {
  return Array.from({ length: STANDARD_ROOM_COUNT }, (_, index) => index + 2);
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
