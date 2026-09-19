import type { Address } from "@hotel100/domain";

export type Occupant = {
  address: Address;
  balanceRaw: bigint;
};

export type RoomSlot = {
  room: number;
  occupant: Occupant | null;
};

export type LobbyGuest = {
  rank: number;
  address: Address;
  balanceRaw: bigint;
};

export type ActivityKind =
  | "check-in"
  | "stay-end"
  | "upgrade"
  | "downgrade"
  | "penthouse-changed"
  | "room-service-arrived"
  | "room-service-claimed";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  atMs: number;
  summary: string;
};

export type GuestCheckInView = {
  walletHeldRaw: bigint;
  unwithdrawnEscrowRaw: bigint;
  effectiveBalanceRaw: bigint;
  stayPhase: "none" | "active" | "expired";
  checkInTimestamp: number | null;
  unlockTimestamp: number | null;
  rewardMultiplierBps: bigint;
  hasUnwithdrawnStay: boolean;
};

export type GuestStayView =
  | { kind: "disconnected" }
  | { kind: "prelive" }
  | {
      kind: "checked_in";
      room: number;
      rank: number;
      balanceRaw: bigint;
      checkedInSinceMs: number | null;
      bestRoom: number | null;
      additionalNeededRaw: bigint;
      targetRoom: number | null;
      claimableWei: bigint;
      checkIn?: GuestCheckInView;
    }
  | {
      kind: "lobby";
      rank: number;
      balanceRaw: bigint;
      room100BalanceRaw: bigint | null;
      additionalNeededRaw: bigint | null;
      bestRoom: number | null;
      claimableWei: bigint;
      checkIn?: GuestCheckInView;
    }
  | {
      kind: "not_checked_in";
      bestRoom: number | null;
      claimableWei: bigint;
      checkIn?: GuestCheckInView;
    };

export type MarketStrip = {
  tokenLabel: "$HOTEL";
  price: string | null;
  marketCap: string | null;
  liquidity: string | null;
  holders: string | null;
  contract: string | null;
};

export type HotelSnapshot = {
  source: "production" | "fixture";
  fixturePreview: boolean;
  hotelLive: boolean;
  canaryPending: boolean;
  lastIndexedAtMs: number | null;
  roomServiceDelayed: boolean;
  connectedWallet: Address | null;
  rooms: RoomSlot[];
  lobby: LobbyGuest[];
  stay: GuestStayView;
  activity: ActivityItem[];
  market: MarketStrip;
  /** Top-100 guests with an active (pre-unlock) unwithdrawn stay. */
  activeCheckedInTop100Count: number;
  checkInEnabled: boolean;
};

export type HotelMode = "production" | "fixture";

export type FixtureScenario = "checked_in" | "lobby" | "former";
