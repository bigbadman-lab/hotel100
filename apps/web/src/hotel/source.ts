import type { Address } from "@hotel100/domain";
import { emptyRooms, latestActivity, presentCheckedInStay, presentLobbyStay } from "./present";
import type {
  ActivityItem,
  FixtureScenario,
  HotelSnapshot,
  MarketStrip,
  Occupant,
  RoomSlot,
} from "./types";

const USER = "0x0000000000000000000000000000000000000a31" as Address;
const ABOVE = "0x0000000000000000000000000000000000000046" as Address;
const PENTHOUSE = "0x0000000000000000000000000000000000000071" as Address;
const DOOR = "0x0000000000000000000000000000000000000100" as Address;
const LOBBY_USER = "0x0000000000000000000000000000000000000104" as Address;

export const FIXTURE_WALLET = USER;
export const FIXTURE_MOVE_UP_RAW = 31_440n;

const EMPTY_MARKET: MarketStrip = {
  tokenLabel: "$HOTEL",
  price: null,
  marketCap: null,
  liquidity: null,
  holders: null,
  contract: null,
};

function addr(n: number): Address {
  return `0x${n.toString(16).padStart(40, "0")}` as Address;
}

function withOccupant(rooms: RoomSlot[], room: number, occupant: Occupant): RoomSlot[] {
  return rooms.map((slot) => (slot.room === room ? { ...slot, occupant } : slot));
}

function balanceForRoom(room: number): bigint {
  if (room === 1) return 4_820_000n;
  if (room === 46) return 215_659n;
  if (room === 47) return 184_220n;
  if (room < 46) return BigInt(300_000 + (46 - room) * 1_000);
  return BigInt(Math.max(1_000, 180_000 - (room - 47) * 500));
}

function occupyDescending(vacantFrom: number): RoomSlot[] {
  let rooms = emptyRooms();
  for (let room = 1; room < vacantFrom; room += 1) {
    const occupant: Occupant = {
      address: room === 1 ? PENTHOUSE : room === 46 ? ABOVE : room === 47 ? USER : addr(room),
      balanceRaw: balanceForRoom(room),
    };
    rooms = withOccupant(rooms, room, occupant);
  }
  return rooms;
}

const ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    kind: "check-in",
    atMs: 1_700_000_004_000,
    summary: "0x8f2…19c checked into Room 72",
  },
  {
    id: "a2",
    kind: "upgrade",
    atMs: 1_700_000_003_000,
    summary: "0x33a…e10 upgraded Room 19 → 11",
  },
  {
    id: "a3",
    kind: "room-service-arrived",
    atMs: 1_700_000_002_000,
    summary: "Room Service arrived · 0.42 ETH served",
  },
  {
    id: "a4",
    kind: "penthouse-changed",
    atMs: 1_700_000_001_000,
    summary: "0x71c…91b2 took the Penthouse",
  },
  {
    id: "a5",
    kind: "downgrade",
    atMs: 1_700_000_000_000,
    summary: "0x5d1…0aa downgraded Room 44 → 51",
  },
];

function base(
  scenarioRooms: RoomSlot[],
  stay: HotelSnapshot["stay"],
  wallet: Address | null,
): HotelSnapshot {
  return {
    source: "fixture",
    fixturePreview: true,
    hotelLive: false,
    canaryPending: true,
    lastIndexedAtMs: null,
    roomServiceDelayed: false,
    connectedWallet: wallet,
    rooms: scenarioRooms,
    lobby: [
      { rank: 101, address: addr(101), balanceRaw: 12_400n },
      { rank: 102, address: addr(102), balanceRaw: 12_100n },
      { rank: 103, address: addr(103), balanceRaw: 11_800n },
      { rank: 104, address: LOBBY_USER, balanceRaw: 9_000n },
    ],
    stay,
    activity: latestActivity(ACTIVITY),
    market: {
      tokenLabel: "$HOTEL",
      price: "$0.00182",
      marketCap: "$182K",
      liquidity: "$48K",
      holders: "241",
      contract: null,
    },
  };
}

export function fixtureSnapshot(scenario: FixtureScenario = "checked_in"): HotelSnapshot {
  if (scenario === "former") {
    const rooms = occupyDescending(96);
    return base(
      rooms,
      { kind: "not_checked_in", bestRoom: 31, claimableWei: 1_500_000_000_000_000n },
      USER,
    );
  }

  if (scenario === "lobby") {
    let rooms = emptyRooms();
    for (let room = 1; room <= 100; room += 1) {
      rooms = withOccupant(rooms, room, {
        address: room === 100 ? DOOR : room === 1 ? PENTHOUSE : addr(room),
        balanceRaw: BigInt(1_000_000 - room * 100),
      });
    }
    rooms = withOccupant(rooms, 100, { address: DOOR, balanceRaw: 20_000n });
    return base(
      rooms,
      presentLobbyStay({
        rank: 104,
        balanceRaw: 9_000n,
        userAddress: LOBBY_USER,
        bestRoom: 88,
        claimableWei: 2_000_000_000_000_000n,
        rooms,
      }),
      LOBBY_USER,
    );
  }

  const rooms = occupyDescending(96);
  return base(
    rooms,
    presentCheckedInStay({
      room: 47,
      balanceRaw: 184_220n,
      userAddress: USER,
      checkedInSinceMs: Date.UTC(2026, 8, 18, 18, 46, 0),
      bestRoom: 31,
      claimableWei: 4_821_000_000_000_000n,
      rooms,
    }),
    USER,
  );
}

export function productionSnapshot(hotelLive: boolean): HotelSnapshot {
  return {
    source: "production",
    fixturePreview: false,
    hotelLive,
    canaryPending: true,
    lastIndexedAtMs: hotelLive ? null : null,
    roomServiceDelayed: false,
    connectedWallet: null,
    rooms: emptyRooms(),
    lobby: [],
    stay: hotelLive ? { kind: "disconnected" } : { kind: "prelive" },
    activity: [],
    market: EMPTY_MARKET,
  };
}

export function resolveHotelMode(args: {
  hotelLive: boolean;
  allowFixturePreview: boolean;
  preview: string | undefined;
}): "production" | "fixture" {
  if (args.hotelLive || !args.allowFixturePreview) return "production";
  return args.preview === "fixture" ? "fixture" : "production";
}

export function loadHotelSnapshot(args: {
  mode: "production" | "fixture";
  hotelLive: boolean;
  scenario?: FixtureScenario;
}): HotelSnapshot {
  if (args.mode === "fixture" && !args.hotelLive)
    return fixtureSnapshot(args.scenario ?? "checked_in");
  return productionSnapshot(args.hotelLive);
}
