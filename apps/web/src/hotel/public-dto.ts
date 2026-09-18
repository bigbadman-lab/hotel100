import { type Address, normalizeAddress } from "@hotel100/domain";
import type {
  ActivityItem,
  ActivityKind,
  GuestStayView,
  HotelSnapshot,
  MarketStrip,
} from "./types";

/** Ranks 101–108. Matches the lobby queue the façade already shows. */
export const PUBLIC_LOBBY_LIMIT = 8;

const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "check-in",
  "stay-end",
  "upgrade",
  "downgrade",
  "penthouse-changed",
  "room-service-arrived",
  "room-service-claimed",
];

export type PublicRoomDto = {
  room: number;
  rank: number;
  address: string | null;
  balanceRaw: string | null;
  checkedInSinceMs: number | null;
  bestRoomEver: number | null;
};

export type PublicLobbyDto = {
  rank: number;
  address: string;
  balanceRaw: string;
};

export type PublicStayDto =
  | { kind: "disconnected" }
  | { kind: "prelive" }
  | {
      kind: "checked_in";
      room: number;
      rank: number;
      balanceRaw: string;
      checkedInSinceMs: number | null;
      bestRoom: number | null;
      additionalNeededRaw: string;
      targetRoom: number | null;
      claimableWei: string;
    }
  | {
      kind: "lobby";
      rank: number;
      balanceRaw: string;
      room100BalanceRaw: string | null;
      additionalNeededRaw: string | null;
      bestRoom: number | null;
      claimableWei: string;
    }
  | {
      kind: "not_checked_in";
      bestRoom: number | null;
      claimableWei: string;
    };

export type PublicHotelStateDto = {
  fixturePreview: false;
  hotelLive: boolean;
  canaryPending: boolean;
  syncing: boolean;
  publicStatus: string;
  lastIndexedBlock: string | null;
  lastIndexedAtMs: number | null;
  freshnessMs: number | null;
  roomServiceDelayed: boolean;
  nextServiceBoundaryUnixSeconds: number;
  secondsUntilNextService: number;
  room100ThresholdRaw: string | null;
  connectedWallet: string | null;
  rooms: PublicRoomDto[];
  lobby: PublicLobbyDto[];
  stay: PublicStayDto;
  activity: ActivityItem[];
  market: MarketStrip;
};

function parseRaw(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error("invalid_raw_amount");
  }
  return BigInt(value);
}

function parseStay(stay: PublicStayDto): GuestStayView {
  if (stay.kind === "disconnected" || stay.kind === "prelive") return stay;
  if (stay.kind === "not_checked_in") {
    return {
      kind: "not_checked_in",
      bestRoom: stay.bestRoom,
      claimableWei: parseRaw(stay.claimableWei),
    };
  }
  if (stay.kind === "lobby") {
    return {
      kind: "lobby",
      rank: stay.rank,
      balanceRaw: parseRaw(stay.balanceRaw),
      room100BalanceRaw: stay.room100BalanceRaw === null ? null : parseRaw(stay.room100BalanceRaw),
      additionalNeededRaw:
        stay.additionalNeededRaw === null ? null : parseRaw(stay.additionalNeededRaw),
      bestRoom: stay.bestRoom,
      claimableWei: parseRaw(stay.claimableWei),
    };
  }
  return {
    kind: "checked_in",
    room: stay.room,
    rank: stay.rank,
    balanceRaw: parseRaw(stay.balanceRaw),
    checkedInSinceMs: stay.checkedInSinceMs,
    bestRoom: stay.bestRoom,
    additionalNeededRaw: parseRaw(stay.additionalNeededRaw),
    targetRoom: stay.targetRoom,
    claimableWei: parseRaw(stay.claimableWei),
  };
}

export function snapshotFromPublicDto(dto: PublicHotelStateDto): HotelSnapshot {
  if (dto.fixturePreview !== false) {
    throw new Error("fixture_forbidden");
  }
  const activity = dto.activity.filter((item) => ACTIVITY_KINDS.includes(item.kind));
  return {
    source: "production",
    fixturePreview: false,
    hotelLive: dto.hotelLive,
    canaryPending: dto.canaryPending,
    lastIndexedAtMs: dto.syncing ? null : dto.lastIndexedAtMs,
    roomServiceDelayed: dto.syncing ? false : dto.roomServiceDelayed,
    connectedWallet: dto.connectedWallet ? normalizeAddress(dto.connectedWallet) : null,
    rooms: dto.rooms.map((room) => ({
      room: room.room,
      occupant:
        room.address && room.balanceRaw
          ? {
              address: normalizeAddress(room.address),
              balanceRaw: parseRaw(room.balanceRaw),
            }
          : null,
    })),
    lobby: dto.lobby.map((guest) => ({
      rank: guest.rank,
      address: normalizeAddress(guest.address),
      balanceRaw: parseRaw(guest.balanceRaw),
    })),
    stay: parseStay(dto.stay),
    activity,
    market: {
      tokenLabel: "$HOTEL",
      price: null,
      marketCap: null,
      liquidity: null,
      holders: dto.market.holders,
      contract: dto.market.contract,
    },
  };
}

export function emptyPublicMarket(): MarketStrip {
  return {
    tokenLabel: "$HOTEL",
    price: null,
    marketCap: null,
    liquidity: null,
    holders: null,
    contract: null,
  };
}

export type { Address };
