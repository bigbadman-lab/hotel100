import { type Address, normalizeAddress, ZERO_ADDRESS } from "@hotel100/domain";
import type { HotelTransferLog } from "../rpc/types.js";
import type { IndexerStore } from "./types.js";

/**
 * Apply a single Transfer to holder balances (integer raw units only).
 */
export async function applyTransferToBalances(
  store: IndexerStore,
  log: HotelTransferLog,
): Promise<void> {
  const from = normalizeAddress(log.from);
  const to = normalizeAddress(log.to);
  const value = log.valueRaw;
  if (value < 0n) {
    throw new Error("Transfer value must be non-negative");
  }
  if (value === 0n) {
    return;
  }

  if (from !== ZERO_ADDRESS) {
    const next = (await store.getBalance(from)) - value;
    if (next < 0n) {
      throw new Error(`balance underflow applying transfer for ${from}`);
    }
    await store.setBalance(from, next);
  }

  if (to !== ZERO_ADDRESS) {
    await store.setBalance(to, (await store.getBalance(to)) + value);
  }
}

/** Deterministically rebuild balances from all indexed transfers (restart / reconcile). */
export function reconstructBalancesFromTransfers(
  transfers: HotelTransferLog[],
): Map<Address, bigint> {
  const balances = new Map<Address, bigint>();

  const add = (address: Address, delta: bigint) => {
    const cur = balances.get(address) ?? 0n;
    const next = cur + delta;
    if (next < 0n) {
      throw new Error(`reconstruct underflow at ${address}`);
    }
    if (next === 0n) balances.delete(address);
    else balances.set(address, next);
  };

  for (const log of transfers) {
    const from = normalizeAddress(log.from);
    const to = normalizeAddress(log.to);
    if (log.valueRaw === 0n) continue;
    if (from !== ZERO_ADDRESS) add(from, -log.valueRaw);
    if (to !== ZERO_ADDRESS) add(to, log.valueRaw);
  }

  return balances;
}
