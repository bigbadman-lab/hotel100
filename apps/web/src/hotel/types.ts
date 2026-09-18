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
    }
  | {
      kind: "lobby";
      rank: number;
      balanceRaw: bigint;
      room100BalanceRaw: bigint | null;
      additionalNeededRaw: bigint | null;
      bestRoom: number | null;
      claimableWei: bigint;
    }
  | {
      kind: "not_checked_in";
      bestRoom: number | null;
      claimableWei: bigint;
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
};

export type HotelMode = "production" | "fixture";

export type FixtureScenario = "checked_in" | "lobby" | "former";
