import {
  type Address,
  additionalNeededToBeatTarget,
  HOTEL_ROOM_COUNT,
  isExactServiceBoundary,
  isPublicStateStale,
  LIVE_CANARY_STATUS,
  nextServiceBoundaryStrictlyAfter,
  PUBLIC_ACTIVITY_LIMIT,
  PUBLIC_STALE_THRESHOLD_MS,
  PUBLIC_STATUS,
} from "@hotel100/domain";
import type { ActivityItem, GuestStayView, HotelSnapshot, Occupant, RoomSlot } from "./types";

export type HeaderStatus = {
  label: string;
  tone: "soon" | "live" | "sync" | "delayed" | "arriving" | "canary" | "mvp";
};

export function presentHeaderStatus(args: {
  hotelLive: boolean;
  fixturePreview: boolean;
  canaryPending: boolean;
  lastIndexedAtMs: number | null;
  nowMs: number;
  roomServiceDelayed: boolean;
  arriving: boolean;
}): HeaderStatus {
  if (!args.hotelLive && !args.fixturePreview) {
    return { label: PUBLIC_STATUS.CHECK_IN_OPENS_SOON, tone: "soon" };
  }
  const indexedStale =
    args.hotelLive &&
    (args.lastIndexedAtMs === null ||
      isPublicStateStale(args.lastIndexedAtMs, args.nowMs, PUBLIC_STALE_THRESHOLD_MS));
  if (indexedStale) {
    return { label: PUBLIC_STATUS.SYNCING, tone: "sync" };
  }
  if (args.roomServiceDelayed) {
    return { label: PUBLIC_STATUS.ROOM_SERVICE_DELAYED, tone: "delayed" };
  }
  if (args.arriving) {
    return { label: PUBLIC_STATUS.ROOM_SERVICE_ARRIVING, tone: "arriving" };
  }
  if (args.fixturePreview && !args.hotelLive) {
    return { label: "LIVE", tone: "live" };
  }
  if (args.canaryPending) {
    return { label: LIVE_CANARY_STATUS.CANARY_PENDING, tone: "canary" };
  }
  return { label: LIVE_CANARY_STATUS.MVP_LIVE, tone: "mvp" };
}

export function roomsAreCurrent(args: {
  hotelLive: boolean;
  fixturePreview: boolean;
  lastIndexedAtMs: number | null;
  nowMs: number;
}): boolean {
  if (args.fixturePreview && !args.hotelLive) return true;
  if (!args.hotelLive) return false;
  if (args.lastIndexedAtMs === null) return false;
  return !isPublicStateStale(args.lastIndexedAtMs, args.nowMs, PUBLIC_STALE_THRESHOLD_MS);
}

/** Seconds until the next UTC boundary. Exact boundary ⇒ 0 (ROOM SERVICE ARRIVING). */
export function secondsUntilNextService(nowSeconds: number): number {
  if (!Number.isInteger(nowSeconds) || nowSeconds < 0) return 0;
  if (isExactServiceBoundary(nowSeconds)) return 0;
  return nextServiceBoundaryStrictlyAfter(nowSeconds) - nowSeconds;
}

export function isRoomServiceArriving(nowSeconds: number, delayed: boolean): boolean {
  if (delayed) return false;
  return secondsUntilNextService(nowSeconds) === 0;
}

export function roomServicePanelState(args: {
  delayed: boolean;
  arriving: boolean;
  claimableWei: bigint;
}): "delayed" | "arriving" | "waiting" | "none" {
  if (args.delayed) return "delayed";
  if (args.arriving) return "arriving";
  if (args.claimableWei > 0n) return "waiting";
  return "none";
}

export function emptyRooms(): RoomSlot[] {
  return Array.from({ length: HOTEL_ROOM_COUNT }, (_, index) => ({
    room: index + 1,
    occupant: null,
  }));
}

export function occupantAt(rooms: RoomSlot[], room: number): Occupant | null {
  return rooms.find((slot) => slot.room === room)?.occupant ?? null;
}

export function presentCheckedInStay(args: {
  room: number;
  balanceRaw: bigint;
  userAddress: Address;
  checkedInSinceMs: number | null;
  bestRoom: number | null;
  claimableWei: bigint;
  rooms: RoomSlot[];
}): GuestStayView {
  const targetRoom = args.room <= 1 ? null : args.room - 1;
  const target = targetRoom === null ? null : occupantAt(args.rooms, targetRoom);
  const additionalNeededRaw =
    target === null
      ? 0n
      : additionalNeededToBeatTarget({
          userAddress: args.userAddress,
          userBalance: args.balanceRaw,
          targetAddress: target.address,
          targetBalance: target.balanceRaw,
        });
  return {
    kind: "checked_in",
    room: args.room,
    rank: args.room,
    balanceRaw: args.balanceRaw,
    checkedInSinceMs: args.checkedInSinceMs,
    bestRoom: args.bestRoom,
    additionalNeededRaw,
    targetRoom,
    claimableWei: args.claimableWei,
  };
}

export function presentLobbyStay(args: {
  rank: number;
  balanceRaw: bigint;
  userAddress: Address;
  bestRoom: number | null;
  claimableWei: bigint;
  rooms: RoomSlot[];
}): GuestStayView {
  const door = occupantAt(args.rooms, HOTEL_ROOM_COUNT);
  return {
    kind: "lobby",
    rank: args.rank,
    balanceRaw: args.balanceRaw,
    room100BalanceRaw: door?.balanceRaw ?? null,
    additionalNeededRaw:
      door === null
        ? null
        : additionalNeededToBeatTarget({
            userAddress: args.userAddress,
            userBalance: args.balanceRaw,
            targetAddress: door.address,
            targetBalance: door.balanceRaw,
          }),
    bestRoom: args.bestRoom,
    claimableWei: args.claimableWei,
  };
}

export function latestActivity(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => b.atMs - a.atMs).slice(0, PUBLIC_ACTIVITY_LIMIT);
}

export function connectedRoom(snapshot: HotelSnapshot): number | null {
  if (snapshot.stay.kind === "checked_in") return snapshot.stay.room;
  return null;
}
