import { type Address, normalizeAddress } from "@hotel100/domain";
import type { ChainReader } from "../rpc/types.js";

export function isEmptyCode(code: string): boolean {
  return code === "0x" || code === "0x0" || code === "";
}

/**
 * Snapshot-block EOA eligibility: eth_getCode(wallet, snapshotBlock) == 0x
 * plus exclusion set membership.
 */
export async function isEligibleEoaAtSnapshot(args: {
  reader: ChainReader;
  address: string;
  snapshotBlock: bigint;
  exclusions: Set<string>;
}): Promise<boolean> {
  const address = normalizeAddress(args.address);
  if (args.exclusions.has(address)) {
    return false;
  }
  const code = await args.reader.getCode(address, args.snapshotBlock);
  return isEmptyCode(code);
}

export async function filterEligibleHolders(args: {
  reader: ChainReader;
  holders: Array<{ address: Address; balanceRaw: bigint }>;
  snapshotBlock: bigint;
  exclusions: Set<string>;
}): Promise<Array<{ address: Address; balanceRaw: bigint }>> {
  const out: Array<{ address: Address; balanceRaw: bigint }> = [];
  for (const h of args.holders) {
    if (h.balanceRaw <= 0n) continue;
    const ok = await isEligibleEoaAtSnapshot({
      reader: args.reader,
      address: h.address,
      snapshotBlock: args.snapshotBlock,
      exclusions: args.exclusions,
    });
    if (ok) out.push(h);
  }
  return out;
}
