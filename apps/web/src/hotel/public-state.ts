import {
  type Address,
  BURN_ADDRESSES,
  findRankHundredHolder,
  HOTEL_ROOM_COUNT,
  isExactServiceBoundary,
  isPublicStateStale,
  LIVE_CANARY_STATUS,
  nextServiceBoundaryStrictlyAfter,
  normalizeAddress,
  PUBLIC_ACTIVITY_LIMIT,
  PUBLIC_STALE_THRESHOLD_MS,
  PUBLIC_STATUS,
  type RankedHolder,
  rankEligibleHolders,
  roomAssignmentForRank,
} from "@hotel100/domain";
import { EntitlementError } from "../entitlement/errors";
import { entitlementJson } from "../entitlement/headers";
import { createPgSqlExecutor, requireDatabaseUrl } from "../entitlement/production";
import type { SqlExecutor } from "../entitlement/sql";
import {
  effectiveProtocol,
  entitlementTransportAllowed,
  requestHostname,
  transportModeFromEnv,
} from "../entitlement/transport";
import { shortenAddress } from "./format";
import {
  emptyRooms,
  presentCheckedInStay,
  presentLobbyStay,
  secondsUntilNextService,
} from "./present";
import {
  emptyPublicMarket,
  PUBLIC_LOBBY_LIMIT,
  type PublicHotelStateDto,
  type PublicLobbyDto,
  type PublicRoomDto,
  type PublicStayDto,
} from "./public-dto";
import type { ActivityItem, ActivityKind, RoomSlot } from "./types";

const PUBLIC_EVENT_CLASSES = [
  "check-in",
  "stay-end",
  "upgrade",
  "downgrade",
  "penthouse-changed",
  "room-service-arrived",
  "room-service-claimed",
] as const satisfies readonly ActivityKind[];

type SystemRow = {
  hotel_live: boolean;
  operational_status: string;
  live_canary_status: string;
  public_status: string;
  room_service_delayed: boolean;
  collection_stuck: boolean;
  last_indexed_block: string | null;
  last_indexed_at: Date | string | null;
};

type HolderRow = { address: string; balance_raw: string };
type StayRow = {
  guest_address: string;
  checked_in_at: Date | string | null;
  best_room_ever: number | null;
  not_checked_in: boolean;
  is_active: boolean;
};
type HistoryRow = { guest_address: string; best_room: number };
type ActivityRow = {
  id: string;
  event_class: string;
  guest_address: string | null;
  payload: unknown;
  occurred_at: Date | string;
};

type StayInfo = {
  checkedInSinceMs: number | null;
  bestRoomEver: number | null;
};

/**
 * Read-only canonical hotel state.
 * Ranking is `rankEligibleHolders` + `roomAssignmentForRank` from @hotel100/domain.
 * Occupancy is withheld when the index is stale or not current.
 * Tables read: system_state, holders, excluded_addresses, guest_stays, room_history,
 * guest_entitlements, room_service_claims (confirmed tx only), public_activity,
 * hotel_deployment (token address only).
 * Not read: auth_nonces, operational_incidents, worker_write_audit, signer keys.
 */
export async function readCanonicalHotelState(
  sql: SqlExecutor,
  args: { nowMs: number; wallet: Address | null },
): Promise<PublicHotelStateDto> {
  const nowSeconds = Math.max(0, Math.floor(args.nowMs / 1000));
  const nextServiceBoundaryUnixSeconds = isExactServiceBoundary(nowSeconds)
    ? nowSeconds
    : nextServiceBoundaryStrictlyAfter(nowSeconds);
  const serviceClock = {
    nextServiceBoundaryUnixSeconds,
    secondsUntilNextService: secondsUntilNextService(nowSeconds),
  };

  const systemResult = await sql.query<SystemRow>(
    `SELECT hotel_live,
            operational_status,
            live_canary_status,
            public_status,
            room_service_delayed,
            collection_stuck,
            last_indexed_block::text AS last_indexed_block,
            last_indexed_at
       FROM system_state
      WHERE id = 1`,
  );
  const system = systemResult.rows[0];
  if (!system) {
    return withheldState({
      nowMs: args.nowMs,
      wallet: args.wallet,
      hotelLive: true,
      syncing: true,
      canaryPending: true,
      publicStatus: PUBLIC_STATUS.SYNCING,
      lastIndexedBlock: null,
      lastIndexedAtMs: null,
      roomServiceDelayed: false,
      ...serviceClock,
      marketContract: null,
      activity: [],
    });
  }

  const hotelLive = toBoolean(system.hotel_live);
  const lastIndexedAtMs = toMs(system.last_indexed_at);
  const lastIndexedBlock = system.last_indexed_block;
  const current = indexIsCurrent({
    hotelLive,
    lastIndexedAtMs,
    lastIndexedBlock,
    operationalStatus: system.operational_status,
    publicStatus: system.public_status,
    nowMs: args.nowMs,
  });
  const syncing = hotelLive && !current;
  const delayed = toBoolean(system.room_service_delayed) || toBoolean(system.collection_stuck);
  const canaryPending = system.live_canary_status === LIVE_CANARY_STATUS.CANARY_PENDING;
  const [activity, marketContract] = await Promise.all([
    readPublicActivity(sql),
    readTokenAddress(sql),
  ]);

  if (!hotelLive || syncing) {
    return withheldState({
      nowMs: args.nowMs,
      wallet: args.wallet,
      hotelLive,
      syncing,
      canaryPending,
      publicStatus: hotelLive ? PUBLIC_STATUS.SYNCING : PUBLIC_STATUS.CHECK_IN_OPENS_SOON,
      lastIndexedBlock,
      lastIndexedAtMs,
      roomServiceDelayed: false,
      ...serviceClock,
      marketContract,
      activity,
    });
  }

  const ranked = await readRankedHolders(sql);
  const stays = await readStayInfo(sql);
  const door = findRankHundredHolder(ranked);
  const rooms = roomsFromRanked(ranked, stays);
  const lobby = lobbyFromRanked(ranked);
  const stay = await stayForWallet({
    sql,
    wallet: args.wallet,
    ranked,
    stays,
    rooms,
  });

  return {
    fixturePreview: false,
    hotelLive: true,
    canaryPending,
    syncing: false,
    publicStatus: delayed ? PUBLIC_STATUS.ROOM_SERVICE_DELAYED : system.live_canary_status,
    lastIndexedBlock,
    lastIndexedAtMs,
    freshnessMs: lastIndexedAtMs === null ? null : args.nowMs - lastIndexedAtMs,
    roomServiceDelayed: delayed,
    ...serviceClock,
    room100ThresholdRaw: door ? door.balanceRaw.toString() : null,
    connectedWallet: args.wallet,
    rooms,
    lobby,
    stay,
    activity,
    market: {
      ...emptyPublicMarket(),
      holders: String(ranked.length),
      contract: marketContract,
    },
  };
}

export async function handlePublicHotelState(
  request: Request,
  env: Record<string, string | undefined>,
  deps: { sql?: SqlExecutor; nowMs?: number } = {},
): Promise<Response> {
  const allowed = entitlementTransportAllowed({
    mode: transportModeFromEnv(env.NODE_ENV),
    protocol: effectiveProtocol(request),
    hostname: requestHostname(request),
  });
  if (!allowed) return entitlementJson(403, { error: "insecure_transport" });

  let wallet: Address | null = null;
  const walletParam = new URL(request.url).searchParams.get("wallet");
  if (walletParam && walletParam.trim() !== "") {
    try {
      wallet = normalizeAddress(walletParam);
    } catch {
      return entitlementJson(400, { error: "invalid_wallet" });
    }
  }

  let sql = deps.sql;
  if (!sql) {
    try {
      sql = createPgSqlExecutor(requireDatabaseUrl(env.DATABASE_URL));
    } catch (error) {
      if (error instanceof EntitlementError) {
        return entitlementJson(error.status, { error: error.code });
      }
      return entitlementJson(503, { error: "database_unconfigured" });
    }
  }

  try {
    const state = await readCanonicalHotelState(sql, {
      nowMs: deps.nowMs ?? Date.now(),
      wallet,
    });
    return entitlementJson(200, state);
  } catch {
    return entitlementJson(503, { error: "state_unavailable" });
  }
}

function indexIsCurrent(args: {
  hotelLive: boolean;
  lastIndexedAtMs: number | null;
  lastIndexedBlock: string | null;
  operationalStatus: string;
  publicStatus: string;
  nowMs: number;
}): boolean {
  if (!args.hotelLive) return false;
  if (args.lastIndexedAtMs === null || args.lastIndexedBlock === null) return false;
  if (isPublicStateStale(args.lastIndexedAtMs, args.nowMs, PUBLIC_STALE_THRESHOLD_MS)) return false;
  if (
    args.operationalStatus === "INDEXING_GAP" ||
    args.operationalStatus === PUBLIC_STATUS.SYNCING
  ) {
    return false;
  }
  if (args.publicStatus === PUBLIC_STATUS.SYNCING) return false;
  return true;
}

async function readRankedHolders(sql: SqlExecutor): Promise<RankedHolder[]> {
  const [holders, excluded] = await Promise.all([
    sql.query<HolderRow>(
      `SELECT address, balance_raw::text AS balance_raw
         FROM holders
        WHERE balance_raw > 0`,
    ),
    sql.query<{ address: string }>(`SELECT address FROM excluded_addresses`),
  ]);
  const blocked = new Set<string>(BURN_ADDRESSES);
  for (const row of excluded.rows) blocked.add(normalizeAddress(row.address));
  const eligible = holders.rows
    .map((row) => ({
      address: normalizeAddress(row.address),
      balanceRaw: BigInt(row.balance_raw),
    }))
    .filter((holder) => holder.balanceRaw > 0n && !blocked.has(holder.address));
  return rankEligibleHolders(eligible);
}

async function readStayInfo(sql: SqlExecutor): Promise<Map<string, StayInfo>> {
  const [stays, history] = await Promise.all([
    sql.query<StayRow>(
      `SELECT guest_address, checked_in_at, best_room_ever, not_checked_in, is_active
         FROM guest_stays`,
    ),
    sql.query<HistoryRow>(
      `SELECT guest_address, MIN(room_number)::int AS best_room
         FROM room_history
        GROUP BY guest_address`,
    ),
  ]);
  const info = new Map<string, StayInfo>();
  for (const row of history.rows) {
    const address = normalizeAddress(row.guest_address);
    info.set(address, {
      checkedInSinceMs: null,
      bestRoomEver: positiveRoom(row.best_room),
    });
  }
  for (const row of stays.rows) {
    const address = normalizeAddress(row.guest_address);
    const current = info.get(address) ?? { checkedInSinceMs: null, bestRoomEver: null };
    const active = toBoolean(row.is_active) && !toBoolean(row.not_checked_in);
    info.set(address, {
      checkedInSinceMs: active
        ? (toMs(row.checked_in_at) ?? current.checkedInSinceMs)
        : current.checkedInSinceMs,
      bestRoomEver: betterRoom(current.bestRoomEver, positiveRoom(row.best_room_ever)),
    });
  }
  return info;
}

function roomsFromRanked(ranked: RankedHolder[], stays: Map<string, StayInfo>): PublicRoomDto[] {
  const byRoom = new Map<number, RankedHolder>();
  for (const holder of ranked) {
    const assignment = roomAssignmentForRank(holder.rank);
    if (assignment.kind === "penthouse" || assignment.kind === "room") {
      byRoom.set(assignment.room, holder);
    }
  }
  return Array.from({ length: HOTEL_ROOM_COUNT }, (_, index) => {
    const room = index + 1;
    const holder = byRoom.get(room);
    if (!holder) {
      return {
        room,
        rank: room,
        address: null,
        balanceRaw: null,
        checkedInSinceMs: null,
        bestRoomEver: null,
      };
    }
    const stay = stays.get(holder.address);
    return {
      room,
      rank: holder.rank,
      address: holder.address,
      balanceRaw: holder.balanceRaw.toString(),
      checkedInSinceMs: stay?.checkedInSinceMs ?? null,
      bestRoomEver: stay?.bestRoomEver ?? null,
    };
  });
}

function lobbyFromRanked(ranked: RankedHolder[]): PublicLobbyDto[] {
  const lobby: PublicLobbyDto[] = [];
  for (const holder of ranked) {
    if (roomAssignmentForRank(holder.rank).kind !== "lobby") continue;
    lobby.push({
      rank: holder.rank,
      address: holder.address,
      balanceRaw: holder.balanceRaw.toString(),
    });
    if (lobby.length === PUBLIC_LOBBY_LIMIT) break;
  }
  return lobby;
}

async function stayForWallet(args: {
  sql: SqlExecutor;
  wallet: Address | null;
  ranked: RankedHolder[];
  stays: Map<string, StayInfo>;
  rooms: PublicRoomDto[];
}): Promise<PublicStayDto> {
  if (!args.wallet) return { kind: "disconnected" };
  const holder = args.ranked.find((row) => row.address === args.wallet);
  const assignment = holder ? roomAssignmentForRank(holder.rank) : { kind: "not_ranked" as const };
  const claimableWei = await indexedClaimableWei(args.sql, args.wallet);
  const info = args.stays.get(args.wallet);
  const slots = toRoomSlots(args.rooms);
  if ((assignment.kind === "penthouse" || assignment.kind === "room") && holder) {
    const stay = presentCheckedInStay({
      room: assignment.room,
      balanceRaw: holder.balanceRaw,
      userAddress: args.wallet,
      checkedInSinceMs: info?.checkedInSinceMs ?? null,
      bestRoom: info?.bestRoomEver ?? null,
      claimableWei,
      rooms: slots,
    });
    if (stay.kind !== "checked_in") return { kind: "disconnected" };
    return {
      kind: "checked_in",
      room: stay.room,
      rank: stay.rank,
      balanceRaw: stay.balanceRaw.toString(),
      checkedInSinceMs: stay.checkedInSinceMs,
      bestRoom: stay.bestRoom,
      additionalNeededRaw: stay.additionalNeededRaw.toString(),
      targetRoom: stay.targetRoom,
      claimableWei: stay.claimableWei.toString(),
    };
  }
  if (assignment.kind === "lobby" && holder) {
    const stay = presentLobbyStay({
      rank: holder.rank,
      balanceRaw: holder.balanceRaw,
      userAddress: args.wallet,
      bestRoom: info?.bestRoomEver ?? null,
      claimableWei,
      rooms: slots,
    });
    if (stay.kind !== "lobby") return { kind: "disconnected" };
    return {
      kind: "lobby",
      rank: stay.rank,
      balanceRaw: stay.balanceRaw.toString(),
      room100BalanceRaw: stay.room100BalanceRaw === null ? null : stay.room100BalanceRaw.toString(),
      additionalNeededRaw:
        stay.additionalNeededRaw === null ? null : stay.additionalNeededRaw.toString(),
      bestRoom: stay.bestRoom,
      claimableWei: stay.claimableWei.toString(),
    };
  }
  return {
    kind: "not_checked_in",
    bestRoom: info?.bestRoomEver ?? null,
    claimableWei: claimableWei.toString(),
  };
}

async function indexedClaimableWei(sql: SqlExecutor, wallet: Address): Promise<bigint> {
  const [earned, claimed] = await Promise.all([
    sql.query<{ earned: string }>(
      `SELECT cumulative_earned_wei::text AS earned
         FROM guest_entitlements
        WHERE guest_address = $1`,
      [wallet],
    ),
    sql.query<{ claimed: string }>(
      `SELECT COALESCE(MAX(cumulative_entitlement_wei), 0)::text AS claimed
         FROM room_service_claims
        WHERE guest_address = $1
          AND tx_hash IS NOT NULL`,
      [wallet],
    ),
  ]);
  const earnedRaw = earned.rows[0] ? BigInt(earned.rows[0].earned) : 0n;
  const claimedRaw = BigInt(claimed.rows[0]?.claimed ?? "0");
  return earnedRaw > claimedRaw ? earnedRaw - claimedRaw : 0n;
}

async function readPublicActivity(sql: SqlExecutor): Promise<ActivityItem[]> {
  const result = await sql.query<ActivityRow>(
    `SELECT id::text AS id, event_class, guest_address, payload, occurred_at
       FROM public_activity
      WHERE event_class IN (
        'check-in',
        'stay-end',
        'upgrade',
        'downgrade',
        'penthouse-changed',
        'room-service-arrived',
        'room-service-claimed'
      )
      ORDER BY occurred_at DESC
      LIMIT ${PUBLIC_ACTIVITY_LIMIT}`,
  );
  const items: ActivityItem[] = [];
  for (const row of result.rows) {
    if (!isActivityKind(row.event_class)) continue;
    const atMs = toMs(row.occurred_at);
    if (atMs === null) continue;
    items.push({
      id: row.id,
      kind: row.event_class,
      atMs,
      summary: publicActivitySummary(row.event_class, row.guest_address, row.payload),
    });
  }
  return items.slice(0, PUBLIC_ACTIVITY_LIMIT);
}

async function readTokenAddress(sql: SqlExecutor): Promise<string | null> {
  const result = await sql.query<{ hotel_token_address: string | null }>(
    `SELECT hotel_token_address
       FROM hotel_deployment
      WHERE hotel_token_address IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1`,
  );
  const address = result.rows[0]?.hotel_token_address;
  if (!address) return null;
  try {
    return normalizeAddress(address);
  } catch {
    return null;
  }
}

function withheldState(args: {
  nowMs: number;
  wallet: Address | null;
  hotelLive: boolean;
  syncing: boolean;
  canaryPending: boolean;
  publicStatus: string;
  lastIndexedBlock: string | null;
  lastIndexedAtMs: number | null;
  roomServiceDelayed: boolean;
  nextServiceBoundaryUnixSeconds: number;
  secondsUntilNextService: number;
  marketContract: string | null;
  activity: ActivityItem[];
}): PublicHotelStateDto {
  return {
    fixturePreview: false,
    hotelLive: args.hotelLive,
    canaryPending: args.canaryPending,
    syncing: args.syncing,
    publicStatus: args.publicStatus,
    lastIndexedBlock: args.lastIndexedBlock,
    lastIndexedAtMs: args.lastIndexedAtMs,
    freshnessMs: args.lastIndexedAtMs === null ? null : args.nowMs - args.lastIndexedAtMs,
    roomServiceDelayed: args.roomServiceDelayed,
    nextServiceBoundaryUnixSeconds: args.nextServiceBoundaryUnixSeconds,
    secondsUntilNextService: args.secondsUntilNextService,
    room100ThresholdRaw: null,
    connectedWallet: args.syncing ? null : args.wallet,
    rooms: emptyRooms().map((slot) => ({
      room: slot.room,
      rank: slot.room,
      address: null,
      balanceRaw: null,
      checkedInSinceMs: null,
      bestRoomEver: null,
    })),
    lobby: [],
    stay: args.hotelLive && args.syncing ? { kind: "disconnected" } : { kind: "prelive" },
    activity: args.activity,
    market: { ...emptyPublicMarket(), contract: args.marketContract },
  };
}

function toRoomSlots(rooms: PublicRoomDto[]): RoomSlot[] {
  return rooms.map((room) => ({
    room: room.room,
    occupant:
      room.address && room.balanceRaw
        ? { address: normalizeAddress(room.address), balanceRaw: BigInt(room.balanceRaw) }
        : null,
  }));
}

function publicActivitySummary(
  eventClass: ActivityKind,
  guest: string | null,
  payload: unknown,
): string {
  const room = payloadRoom(payload, "room") ?? payloadRoom(payload, "toRoom");
  const fromRoom = payloadRoom(payload, "fromRoom");
  const who = guest ? shortenAddress(guest) : "A guest";
  if (eventClass === "check-in") {
    return room === null ? `${who} checked in` : `${who} checked into Room ${room}`;
  }
  if (eventClass === "stay-end") {
    return room === null ? `${who} checked out` : `${who} left Room ${room}`;
  }
  if (eventClass === "upgrade") {
    return fromRoom !== null && room !== null
      ? `${who} upgraded Room ${fromRoom} → ${room}`
      : `${who} upgraded`;
  }
  if (eventClass === "downgrade") {
    return fromRoom !== null && room !== null
      ? `${who} downgraded Room ${fromRoom} → ${room}`
      : `${who} downgraded`;
  }
  if (eventClass === "penthouse-changed") return `${who} took the Penthouse`;
  if (eventClass === "room-service-arrived") return "Room Service arrived";
  return `${who} claimed Room Service`;
}

function payloadRoom(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : null;
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > HOTEL_ROOM_COUNT) {
    return null;
  }
  return parsed;
}

function isActivityKind(value: string): value is ActivityKind {
  return (PUBLIC_EVENT_CLASSES as readonly string[]).includes(value);
}

function betterRoom(current: number | null, next: number | null): number | null {
  if (current === null) return next;
  if (next === null) return current;
  return Math.min(current, next);
}

function positiveRoom(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
  if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > HOTEL_ROOM_COUNT) {
    return null;
  }
  return parsed;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}
