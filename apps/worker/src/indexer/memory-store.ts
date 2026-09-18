import { type Address, normalizeAddress } from "@hotel100/domain";
import type { Hex, HotelTransferLog } from "../rpc/types.js";
import type { HolderRow, IndexerCursor, IndexerStore, PublicStayEvent } from "./types.js";

function transferKey(txHash: string, logIndex: number): string {
  return `${txHash.toLowerCase()}:${logIndex}`;
}

/**
 * In-memory IndexerStore for deterministic unit tests only.
 * Production workers must use createPostgresIndexerStore when DB config is present.
 */
export function createMemoryIndexerStore(): IndexerStore {
  let cursor: IndexerCursor = {
    lastIndexedBlock: null,
    lastTxHash: null,
    lastLogIndex: null,
    lastBlockHash: null,
    lastReconciledBlock: null,
    lastIndexedAtMs: null,
  };
  const transfers = new Map<string, HotelTransferLog>();
  const balances = new Map<Address, bigint>();
  let publicStatus = "HOTEL CHECK-IN OPENS SOON";
  const incidents: string[] = [];
  const publicEvents: PublicStayEvent[] = [];

  return {
    async getCursor() {
      return { ...cursor };
    },
    async setCursor(next) {
      cursor = { ...next };
    },

    async tryInsertTransfer(log) {
      const key = transferKey(log.txHash, log.logIndex);
      if (transfers.has(key)) return false;
      transfers.set(key, {
        ...log,
        txHash: log.txHash.toLowerCase() as Hex,
        from: normalizeAddress(log.from),
        to: normalizeAddress(log.to),
      });
      return true;
    },

    async getTransferCount() {
      return transfers.size;
    },

    async hasTransfer(txHash, logIndex) {
      return transfers.has(transferKey(txHash, logIndex));
    },

    async getBalance(address) {
      return balances.get(normalizeAddress(address)) ?? 0n;
    },

    async setBalance(address, balanceRaw) {
      const addr = normalizeAddress(address);
      if (balanceRaw < 0n) throw new Error(`negative balance for ${addr}`);
      if (balanceRaw === 0n) balances.delete(addr);
      else balances.set(addr, balanceRaw);
    },

    async getAllHolders(): Promise<HolderRow[]> {
      return [...balances.entries()].map(([address, balanceRaw]) => ({ address, balanceRaw }));
    },

    async replaceBalances(next) {
      balances.clear();
      for (const [address, balanceRaw] of next) {
        if (balanceRaw > 0n) balances.set(normalizeAddress(address), balanceRaw);
      }
    },

    async getPublicStatus() {
      return publicStatus;
    },
    async setPublicStatus(status) {
      publicStatus = status;
    },

    async getOperationalIncidentKinds() {
      return [...incidents];
    },
    async recordIncident(kind) {
      incidents.push(kind);
    },
    async clearIncidents() {
      incidents.length = 0;
    },

    async appendPublicStayEvent(event) {
      publicEvents.push(event);
    },
    async getPublicStayEvents() {
      return [...publicEvents];
    },

    async getAllTransfersOrdered() {
      return [...transfers.values()].sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber < b.blockNumber ? -1 : 1;
        }
        if (a.txHash !== b.txHash) return a.txHash < b.txHash ? -1 : 1;
        return a.logIndex - b.logIndex;
      });
    },

    async deleteTransfersAtOrAfter(blockNumber) {
      for (const [key, log] of [...transfers.entries()]) {
        if (log.blockNumber >= blockNumber) transfers.delete(key);
      }
    },

    async replaceTransfers(logs) {
      transfers.clear();
      for (const log of logs) {
        transfers.set(transferKey(log.txHash, log.logIndex), {
          ...log,
          txHash: log.txHash.toLowerCase() as Hex,
          from: normalizeAddress(log.from),
          to: normalizeAddress(log.to),
        });
      }
    },
  };
}
