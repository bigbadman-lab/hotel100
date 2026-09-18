import {
  type Address,
  BURN_ADDRESSES,
  normalizeAddress,
  PUBLIC_STATUS,
  ZERO_ADDRESS,
} from "@hotel100/domain";
import type { AddressHex, Hex, HotelTransferLog } from "../rpc/types.js";

export type IndexerCursor = {
  lastIndexedBlock: bigint | null;
  /** Last successfully indexed log identity within lastIndexedBlock, if any */
  lastTxHash: Hex | null;
  lastLogIndex: number | null;
  lastBlockHash: Hex | null;
  lastReconciledBlock: bigint | null;
  lastIndexedAtMs: number | null;
};

export type HolderRow = {
  address: Address;
  balanceRaw: bigint;
};

export type PublicStayEvent = {
  kind: "check-in" | "stay-end" | "upgrade" | "downgrade" | "penthouse-changed";
  guestAddress: Address;
  fromRoom: number | null;
  toRoom: number | null;
  fromRank: number | null;
  toRank: number | null;
  blockNumber: bigint;
};

export type IndexerStore = {
  getCursor(): Promise<IndexerCursor>;
  setCursor(cursor: IndexerCursor): Promise<void>;

  /** Insert transfer; returns false if (tx_hash, log_index) already present. */
  tryInsertTransfer(log: HotelTransferLog): Promise<boolean>;

  getTransferCount(): Promise<number>;
  hasTransfer(txHash: Hex, logIndex: number): Promise<boolean>;

  getBalance(address: Address): Promise<bigint>;
  setBalance(address: Address, balanceRaw: bigint): Promise<void>;
  getAllHolders(): Promise<HolderRow[]>;

  /** Replace all balances from a reconstructed map (reconciliation). */
  replaceBalances(balances: Map<Address, bigint>): Promise<void>;

  getPublicStatus(): Promise<string>;
  setPublicStatus(status: string): Promise<void>;

  getOperationalIncidentKinds(): Promise<string[]>;
  recordIncident(kind: string): Promise<void>;
  clearIncidents(): Promise<void>;

  /** Public HOTEL history — Gate E only records when post-open. */
  appendPublicStayEvent(event: PublicStayEvent): Promise<void>;
  getPublicStayEvents(): Promise<PublicStayEvent[]>;

  /** All processed transfers in deterministic order for rebuild. */
  getAllTransfersOrdered(): Promise<HotelTransferLog[]>;

  /** Persist reorg rewind: drop transfers at/after block. */
  deleteTransfersAtOrAfter(blockNumber: bigint): Promise<void>;

  /** Replace entire transfer set (tests / full rebuild helpers). */
  replaceTransfers(logs: HotelTransferLog[]): Promise<void>;
};

export type HotelIndexerConfig = {
  hotelTokenAddress: AddressHex;
  hotelLaunchBlock: bigint;
  /** Null ⇒ hotel not open; pre-open: balances only, no public stays/history. */
  hotelOpenBlock: bigint | null;
  hotelOpenTimestamp: number | null;
  liveConfirmations: number;
  publicStaleThresholdMs: number;
  /** Optional protocol exclusions from config — never invent production addresses. */
  roomServiceAddress?: AddressHex;
  hoodLockAddress?: AddressHex;
  ponsV2FactoryAddress?: AddressHex;
  ponsV2RouterAddress?: AddressHex;
  ponsFeeEscrowAddress?: AddressHex;
  manualExclusions: AddressHex[];
};

export function buildExclusionSet(config: HotelIndexerConfig): Set<string> {
  const set = new Set<string>();
  for (const a of BURN_ADDRESSES) {
    set.add(normalizeAddress(a));
  }
  set.add(ZERO_ADDRESS);
  const optional = [
    config.roomServiceAddress,
    config.hoodLockAddress,
    config.ponsV2FactoryAddress,
    config.ponsV2RouterAddress,
    config.ponsFeeEscrowAddress,
    ...config.manualExclusions,
  ];
  for (const a of optional) {
    if (a) set.add(normalizeAddress(a));
  }
  return set;
}

export function isPreOpen(config: HotelIndexerConfig, blockNumber: bigint): boolean {
  if (config.hotelOpenBlock === null) return true;
  return blockNumber < config.hotelOpenBlock;
}

export { PUBLIC_STATUS };
