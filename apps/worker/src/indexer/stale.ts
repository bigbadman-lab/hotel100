import { isPublicStateStale, PUBLIC_STALE_THRESHOLD_MS, PUBLIC_STATUS } from "@hotel100/domain";
import type { IndexerStore } from "./types.js";

export async function refreshStalePublicStatus(
  store: IndexerStore,
  nowMs: number,
  staleThresholdMs: number = PUBLIC_STALE_THRESHOLD_MS,
): Promise<boolean> {
  const cursor = await store.getCursor();
  if (cursor.lastIndexedAtMs === null) {
    await store.setPublicStatus(PUBLIC_STATUS.SYNCING);
    return true;
  }
  const stale = isPublicStateStale(cursor.lastIndexedAtMs, nowMs, staleThresholdMs);
  if (stale) {
    await store.setPublicStatus(PUBLIC_STATUS.SYNCING);
  }
  return stale;
}

export async function markSyncing(store: IndexerStore, incident?: string): Promise<void> {
  await store.setPublicStatus(PUBLIC_STATUS.SYNCING);
  if (incident) await store.recordIncident(incident);
}
