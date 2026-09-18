import { ZERO_ADDRESS } from "./constants.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export type Address = `0x${string}`;

export function isAddressShape(value: string): boolean {
  return ADDRESS_RE.test(value);
}

/**
 * Normalize addresses to lowercase 0x + 40 hex.
 * Does not invent addresses — invalid input throws.
 */
export function normalizeAddress(value: string): Address {
  const trimmed = value.trim();
  if (!isAddressShape(trimmed)) {
    throw new Error(`Invalid address: ${value}`);
  }
  return trimmed.toLowerCase() as Address;
}

export function isZeroAddress(address: string): boolean {
  return normalizeAddress(address) === ZERO_ADDRESS;
}

/** Deterministic numeric address comparison (not checksum string lexicographic). */
export function addressToNumeric(address: string): bigint {
  return BigInt(normalizeAddress(address));
}

/**
 * Returns:
 *  -1 if a < b (numeric)
 *   0 if a === b
 *   1 if a > b
 */
export function compareAddressNumeric(a: string, b: string): -1 | 0 | 1 {
  const na = addressToNumeric(a);
  const nb = addressToNumeric(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

export function addressLessThan(a: string, b: string): boolean {
  return compareAddressNumeric(a, b) < 0;
}

export function addressLessThanOrEqual(a: string, b: string): boolean {
  return compareAddressNumeric(a, b) <= 0;
}
