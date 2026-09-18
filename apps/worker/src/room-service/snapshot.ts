import { FINANCIAL_CONFIRMATIONS } from "@hotel100/domain";
import { type ChainReader, indexableHead } from "../rpc/types.js";

/**
 * Latest block at or before the Service boundary with at least 2 confirmations.
 * Confirmation depth matches indexableHead(tip, 2): block <= tip - 2.
 */
export async function selectFinancialSnapshotBlock(args: {
  reader: ChainReader;
  boundaryTimestamp: number;
  requiredConfirmations?: number;
}): Promise<bigint | null> {
  const required = args.requiredConfirmations ?? FINANCIAL_CONFIRMATIONS;
  const latest = await args.reader.getLatestBlockNumber();
  let cursor = indexableHead(latest, required);

  for (let i = 0; i < 20_000 && cursor >= 0n; i++) {
    const ts = await args.reader.getBlockTimestamp(cursor);
    if (ts === null) return null;
    if (ts <= args.boundaryTimestamp) return cursor;
    if (cursor === 0n) return null;
    cursor -= 1n;
  }
  return null;
}

export { FINANCIAL_CONFIRMATIONS };
