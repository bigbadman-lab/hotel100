import { type Address, additionalNeededToBeatTarget } from "@hotel100/domain";
import Image from "next/image";
import type { ReactElement } from "react";
import {
  formatActivityClock,
  formatEthFromWei,
  formatRawUnits,
  formatRelativeTime,
  formatStayDuration,
  shortenAddress,
} from "../format";
import type { HeaderStatus } from "../present";
import type {
  ActivityItem,
  ActivityKind,
  GuestStayView,
  HotelSnapshot,
  LobbyGuest,
  Occupant,
  RoomSlot,
} from "../types";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BellIcon,
  ClockIcon,
  CopyIcon,
  CrownIcon,
  DoorIcon,
  KeyIcon,
  LedgerIcon,
  MarketIcon,
  StarIcon,
} from "./icons";

const HOTEL_LOGO_SRC = "/brand/hotel100-logo3.png";
const HEDGE_TREES = [
  "t0",
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "t8",
  "t9",
  "t10",
  "t11",
  "t12",
  "t13",
  "t14",
  "t15",
  "t16",
  "t17",
  "t18",
  "t19",
  "t20",
  "t21",
] as const;

const ACTIVITY_ICONS: Record<ActivityKind, (p: { className?: string }) => ReactElement> = {
  "check-in": KeyIcon,
  upgrade: ArrowUpIcon,
  downgrade: ArrowDownIcon,
  "room-service-arrived": BellIcon,
  "room-service-claimed": BellIcon,
  "penthouse-changed": CrownIcon,
  "stay-end": DoorIcon,
};

const ACTIVITY_ICON_CLASS: Record<ActivityKind, string> = {
  "check-in": "check-in",
  upgrade: "upgrade",
  downgrade: "downgrade",
  "room-service-arrived": "room-service",
  "room-service-claimed": "room-service",
  "penthouse-changed": "penthouse",
  "stay-end": "check-out",
};

/** Row 1 holds rooms 2–10 (9 windows); rows 2–10 hold ten windows each. */
function buildRows(rooms: RoomSlot[]): RoomSlot[][] {
  const standard = rooms.filter((r) => r.room >= 2);
  const rows: RoomSlot[][] = [standard.slice(0, 9)];
  for (let i = 9; i < standard.length; i += 10) {
    rows.push(standard.slice(i, i + 10));
  }
  return rows;
}

function roomAriaLabel(slot: RoomSlot, you: boolean, selected: boolean): string {
  const base = slot.occupant
    ? `Room ${slot.room}, rank ${slot.room}, occupied by ${slot.occupant.address}`
    : `Room ${slot.room}, vacant`;
  return `${base}${you ? ", your room" : ""}${selected ? ", selected" : ""}`;
}

function penthouseAriaLabel(slot: RoomSlot | undefined, you: boolean, selected: boolean): string {
  const base = slot?.occupant
    ? `Penthouse, Room 01, occupied by ${slot.occupant.address}`
    : "Penthouse, Room 01, vacant";
  return `${base}${you ? ", your room" : ""}${selected ? ", selected" : ""}`;
}

export function HotelHeader(props: {
  status: HeaderStatus;
  serviceLabel: string;
  walletLabel: string;
  onConnect: () => void;
}) {
  const live = props.status.tone === "live" || props.status.tone === "mvp";
  return (
    <header className="hotel-header">
      <div className="hotel-header__brand">
        <span className="hotel-header__bell" aria-hidden="true">
          <BellIcon />
        </span>
        <Image
          className="hotel-header__logo"
          src={HOTEL_LOGO_SRC}
          alt="HOTEL100"
          width={2172}
          height={724}
          priority
        />
        <span className="hotel-header__tagline">100 rooms. No reservations.</span>
      </div>
      <div className="hotel-header__meta">
        <span className={live ? "hotel-pill hotel-pill--live" : "hotel-pill"}>
          <i className="hotel-dot" aria-hidden="true" />
          {live ? "LIVE" : props.status.label}
        </span>
        <span className="hotel-header__rule" aria-hidden="true" />
        <span className="hotel-header__service">
          <span className="hotel-label">Next service</span>
          <span className="hotel-mono hotel-header__clock">{props.serviceLabel}</span>
        </span>
        <button type="button" className="hotel-wallet-btn" onClick={props.onConnect}>
          {props.walletLabel}
        </button>
      </div>
    </header>
  );
}

export function HotelOperationalState(props: { status: HeaderStatus; current: boolean }) {
  if (props.current && props.status.tone === "live") return null;
  if (props.current && props.status.tone === "mvp") return null;
  if (props.status.tone === "soon") {
    return (
      <p className="hotel-op-banner" role="status">
        Check-in has not opened. Rooms stay vacant until HOTEL is live.
      </p>
    );
  }
  if (!props.current) {
    return (
      <p className="hotel-op-banner" role="status">
        {props.status.label}. Indexed room assignments are not current.
      </p>
    );
  }
  if (props.status.tone === "delayed" || props.status.tone === "arriving") {
    return (
      <p className={`hotel-op-banner hotel-op-banner--${props.status.tone}`} role="status">
        {props.status.label}
      </p>
    );
  }
  return null;
}

export function YourStayPanel(props: {
  stay: GuestStayView;
  nowMs: number | null;
  wallet: Address | null;
  onConnect: () => void;
  onFocusRoom: () => void;
}) {
  const stay = props.stay;
  const disconnected = stay.kind === "prelive" || stay.kind === "disconnected";

  async function copyWallet() {
    if (!props.wallet || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(props.wallet);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <section className="hotel-panel hotel-stay" aria-labelledby="your-stay-heading">
      <div className="hotel-panel__head">
        <h2 id="your-stay-heading" className="hotel-panel__title">
          Your Stay
        </h2>
      </div>

      {disconnected ? (
        <div className="hotel-stay__empty">
          <p className="hotel-stay__emptyLead">No key issued.</p>
          <p className="hotel-stay__emptyBody">
            {stay.kind === "prelive"
              ? "Connect a wallet after check-in opens to see your room."
              : "Connect a wallet to see your room, rank and Room Service entitlement."}
          </p>
          <button type="button" className="hotel-btn hotel-btn--ghost" onClick={props.onConnect}>
            Connect Wallet
          </button>
        </div>
      ) : null}

      {stay.kind === "not_checked_in" ? (
        <>
          {props.wallet ? (
            <div className="hotel-walletcard">
              <span className="hotel-walletcard__label">
                <i className="hotel-dot" aria-hidden="true" />
                Connected wallet
              </span>
              <span className="hotel-walletcard__value">
                <span className="hotel-mono">{shortenAddress(props.wallet)}</span>
                <button
                  type="button"
                  className="hotel-walletcard__copy"
                  aria-label="Copy wallet address"
                  onClick={() => void copyWallet()}
                >
                  <CopyIcon />
                </button>
              </span>
            </div>
          ) : null}
          <div className="hotel-stay__room hotel-stay__room--static">
            <span className="hotel-label">Status</span>
            <span className="hotel-stay__roomNumber">—</span>
            <span className="hotel-stay__rank">Not checked in</span>
          </div>
          <dl className="hotel-stay__facts">
            <div className="hotel-stay__fact">
              <StarIcon className="hotel-stay__factIcon" />
              <dt>Best room</dt>
              <dd>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</dd>
            </div>
            <div className="hotel-stay__fact">
              <LedgerIcon className="hotel-stay__factIcon" />
              <dt>Waiting</dt>
              <dd className="hotel-mono">{formatEthFromWei(stay.claimableWei)} ETH</dd>
            </div>
          </dl>
          <StayFob />
        </>
      ) : null}

      {stay.kind === "lobby" ? (
        <>
          {props.wallet ? (
            <div className="hotel-walletcard">
              <span className="hotel-walletcard__label">
                <i className="hotel-dot" aria-hidden="true" />
                Connected wallet
              </span>
              <span className="hotel-walletcard__value">
                <span className="hotel-mono">{shortenAddress(props.wallet)}</span>
                <button
                  type="button"
                  className="hotel-walletcard__copy"
                  aria-label="Copy wallet address"
                  onClick={() => void copyWallet()}
                >
                  <CopyIcon />
                </button>
              </span>
            </div>
          ) : null}
          <div className="hotel-stay__room hotel-stay__room--static">
            <span className="hotel-label">Lobby</span>
            <span className="hotel-stay__roomNumber">—</span>
            <span className="hotel-stay__rank">Rank #{stay.rank}</span>
          </div>
          <div className="hotel-stay__balance">
            <span className="hotel-mono hotel-stay__balanceValue">
              {formatRawUnits(stay.balanceRaw)}
            </span>
            <span className="hotel-stay__balanceUnit">HOTEL</span>
          </div>
          <div className="hotel-movement">
            <span className="hotel-movement__icon" aria-hidden="true">
              <ArrowUpIcon />
            </span>
            <span className="hotel-movement__body">
              {stay.additionalNeededRaw === null ? (
                <>
                  <span className="hotel-mono hotel-movement__amount">ROOM 100 IS VACANT</span>
                  <span className="hotel-movement__caption">A top-100 balance checks in</span>
                </>
              ) : (
                <>
                  <span className="hotel-mono hotel-movement__amount">
                    +{formatRawUnits(stay.additionalNeededRaw)} HOTEL
                  </span>
                  <span className="hotel-movement__caption">
                    to check into Room 100
                    {stay.room100BalanceRaw === null
                      ? ""
                      : ` · door holds ${formatRawUnits(stay.room100BalanceRaw)}`}
                  </span>
                </>
              )}
            </span>
          </div>
          <dl className="hotel-stay__facts">
            <div className="hotel-stay__fact">
              <StarIcon className="hotel-stay__factIcon" />
              <dt>Best room</dt>
              <dd>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</dd>
            </div>
            <div className="hotel-stay__fact">
              <LedgerIcon className="hotel-stay__factIcon" />
              <dt>Waiting</dt>
              <dd className="hotel-mono">{formatEthFromWei(stay.claimableWei)} ETH</dd>
            </div>
          </dl>
          <StayFob />
        </>
      ) : null}

      {stay.kind === "checked_in" ? (
        <>
          {props.wallet ? (
            <div className="hotel-walletcard">
              <span className="hotel-walletcard__label">
                <i className="hotel-dot" aria-hidden="true" />
                Connected wallet
              </span>
              <span className="hotel-walletcard__value">
                <span className="hotel-mono">{shortenAddress(props.wallet)}</span>
                <button
                  type="button"
                  className="hotel-walletcard__copy"
                  aria-label="Copy wallet address"
                  onClick={() => void copyWallet()}
                >
                  <CopyIcon />
                </button>
              </span>
            </div>
          ) : null}
          <button type="button" className="hotel-stay__room" onClick={props.onFocusRoom}>
            <span className="hotel-label">Room</span>
            <span className="hotel-stay__roomNumber">{stay.room}</span>
            <span className="hotel-stay__rank">Rank #{stay.rank}</span>
          </button>
          <div className="hotel-stay__balance">
            <span className="hotel-mono hotel-stay__balanceValue">
              {formatRawUnits(stay.balanceRaw)}
            </span>
            <span className="hotel-stay__balanceUnit">HOTEL</span>
          </div>
          {stay.targetRoom === null ? (
            <div className="hotel-movement">
              <span className="hotel-movement__icon" aria-hidden="true">
                <ArrowUpIcon />
              </span>
              <span className="hotel-movement__body">
                <span className="hotel-mono hotel-movement__amount">PENTHOUSE</span>
                <span className="hotel-movement__caption">Top of the hotel</span>
              </span>
            </div>
          ) : (
            <div className="hotel-movement">
              <span className="hotel-movement__icon" aria-hidden="true">
                <ArrowUpIcon />
              </span>
              <span className="hotel-movement__body">
                <span className="hotel-mono hotel-movement__amount">
                  +{formatRawUnits(stay.additionalNeededRaw)} HOTEL
                </span>
                <span className="hotel-movement__caption">to Room {stay.targetRoom}</span>
              </span>
            </div>
          )}
          <dl className="hotel-stay__facts">
            <div className="hotel-stay__fact">
              <ClockIcon className="hotel-stay__factIcon" />
              <dt>Checked in</dt>
              <dd>
                {props.nowMs === null || stay.checkedInSinceMs === null
                  ? "—"
                  : formatStayDuration(stay.checkedInSinceMs, props.nowMs)}
              </dd>
            </div>
            <div className="hotel-stay__fact">
              <StarIcon className="hotel-stay__factIcon" />
              <dt>Best room</dt>
              <dd>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</dd>
            </div>
          </dl>
          <StayFob />
        </>
      ) : null}
    </section>
  );
}

function StayFob() {
  return (
    <div className="hotel-fob">
      <div className="hotel-fob__tag">
        <span className="hotel-fob__ring" aria-hidden="true" />
        <span className="hotel-fob__mark">HOTEL100</span>
        <span className="hotel-fob__sub">Stay higher</span>
      </div>
      <p className="hotel-fob__motto">
        {"Same "}
        <br />
        {"guests. "}
        <br />
        {"Higher "}
        <br />
        {"rooms."}
      </p>
    </div>
  );
}

export function HotelFacade(props: {
  snapshot: HotelSnapshot;
  selectedRoom: number;
  youRoom: number | null;
  stale: boolean;
  arriving: boolean;
  lightRooms: number[];
  penthouseMotion: boolean;
  entranceMotion: boolean;
  onSelect: (room: number) => void;
}) {
  const penthouse = props.snapshot.rooms.find((slot) => slot.room === 1);
  const rows = buildRows(props.snapshot.rooms);
  const selected = props.snapshot.rooms.find((slot) => slot.room === props.selectedRoom) ?? null;

  return (
    <section
      className={[
        "hotel-facade",
        props.arriving ? "hotel-facade--service" : "",
        props.stale ? "hotel-facade--stale" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="HOTEL100 façade"
      data-testid="hotel-facade"
    >
      <div className="hotel-facade__sky" aria-hidden="true" />

      <div className="hotel-building">
        <div className="hotel-building__pediment" aria-hidden="true">
          <span className="hotel-building__finial" />
        </div>

        <div className="hotel-building__parapet">
          <span className="hotel-building__cornice" aria-hidden="true" />
          <Image
            className="hotel-building__logo"
            src={HOTEL_LOGO_SRC}
            alt="HOTEL100"
            width={2172}
            height={724}
            priority
          />
          <span className="hotel-building__motto">A higher kind of stay.</span>
        </div>

        <div
          className={["hotel-penthouse", props.penthouseMotion ? "motion-takeover" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="hotel-pilaster hotel-pilaster--left" aria-hidden="true" />

          <div className="hotel-penthouse__terrace" aria-hidden="true">
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
          </div>

          <div className="hotel-penthouse__pavilion">
            <span className="hotel-penthouse__roof" aria-hidden="true" />
            <div className="hotel-penthouse__suite" aria-hidden="true">
              <span className="hotel-penthouse__chandelier" />
              <span className="hotel-penthouse__arch" />
              <span className="hotel-penthouse__arch hotel-penthouse__arch--wide" />
              <span className="hotel-penthouse__arch" />
            </div>
            {penthouse ? (
              <button
                id="room-1"
                type="button"
                className={[
                  "hotel-penthouse__plaque",
                  penthouse.occupant ? "is-occupied" : "is-vacant",
                  props.youRoom === 1 ? "is-connected" : "",
                  props.selectedRoom === 1 ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={props.selectedRoom === 1}
                aria-label={penthouseAriaLabel(
                  penthouse,
                  props.youRoom === 1,
                  props.selectedRoom === 1,
                )}
                onClick={() => props.onSelect(1)}
              >
                <span className="hotel-penthouse__label">Penthouse</span>
                <span className="hotel-penthouse__number">Room 01</span>
              </button>
            ) : null}
          </div>

          <div className="hotel-penthouse__holder">
            <span className="hotel-mono hotel-penthouse__holderWallet">
              {penthouse?.occupant ? shortenAddress(penthouse.occupant.address) : "vacant"}
            </span>
            <span className="hotel-mono hotel-penthouse__holderBalance">
              {penthouse?.occupant ? `${formatRawUnits(penthouse.occupant.balanceRaw)} HOTEL` : "—"}
            </span>
          </div>

          <span className="hotel-pilaster hotel-pilaster--right" aria-hidden="true" />
        </div>

        <div className="hotel-rows">
          <span className="hotel-pilaster hotel-pilaster--tall" aria-hidden="true" />
          <span
            className="hotel-pilaster hotel-pilaster--tall hotel-pilaster--right"
            aria-hidden="true"
          />
          {rows.map((row) => (
            <div className="hotel-row" key={row[0]?.room ?? "empty"}>
              {row.map((slot) => {
                const you = props.youRoom === slot.room;
                const selectedRoom = props.selectedRoom === slot.room;
                return (
                  <button
                    key={slot.room}
                    id={`room-${slot.room}`}
                    type="button"
                    data-room={slot.room}
                    className={[
                      "hotel-window",
                      slot.occupant ? "is-occupied" : "is-vacant",
                      you ? "is-connected" : "",
                      selectedRoom ? "is-selected" : "",
                      props.lightRooms.includes(slot.room) ? "motion-light" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ ["--lamp" as string]: (slot.room % 5) / 10 }}
                    aria-pressed={selectedRoom}
                    aria-label={roomAriaLabel(slot, you, selectedRoom)}
                    onClick={() => props.onSelect(slot.room)}
                  >
                    <span className="hotel-window__lintel" aria-hidden="true" />
                    <span className="hotel-window__glass" aria-hidden="true">
                      <span className="hotel-window__curtain" />
                      <span className="hotel-window__curtain hotel-window__curtain--right" />
                      <span className="hotel-window__mullion" />
                      <span className="hotel-window__transom" />
                    </span>
                    <span className="hotel-window__sill" aria-hidden="true" />
                    <span className="hotel-window__plaque">
                      <span className="hotel-window__number hotel-mono">
                        {String(slot.room).padStart(2, "0")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div
          className={["hotel-entrance", props.entranceMotion ? "motion-checkin" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="hotel-entrance__wing" aria-hidden="true">
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
          </div>
          <span className="hotel-entrance__lamp" aria-hidden="true" />
          <div className="hotel-entrance__canopy" aria-hidden="true">
            <span className="hotel-entrance__dome" />
            <span className="hotel-entrance__valance" />
          </div>
          <div className="hotel-entrance__doors">
            <span className="hotel-entrance__sign">HOTEL100</span>
            <span className="hotel-entrance__door" aria-hidden="true" />
            <span className="hotel-entrance__door" aria-hidden="true" />
          </div>
          <span className="hotel-entrance__lamp hotel-entrance__lamp--right" aria-hidden="true" />
          <div className="hotel-entrance__wing hotel-entrance__wing--right" aria-hidden="true">
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
          </div>
          <p className="hotel-entrance__plaque">
            100 rooms.
            <br />
            No reservations.
          </p>
        </div>

        <div className="hotel-plinth" aria-hidden="true">
          <span className="hotel-plinth__step" />
          <span className="hotel-plinth__step hotel-plinth__step--wide" />
        </div>

        <div className="hotel-hedge" aria-hidden="true">
          {HEDGE_TREES.map((id, tree) => (
            <span key={id} className="hotel-hedge__tree" style={{ ["--i" as string]: tree }} />
          ))}
        </div>
      </div>

      <SelectedRoomFoot slot={selected} you={props.youRoom === props.selectedRoom} />
    </section>
  );
}

export function SelectedRoomFoot(props: { slot: RoomSlot | null; you: boolean }) {
  if (!props.slot) {
    return (
      <div className="hotel-facade__foot">
        <p className="hotel-facade__quiet" aria-hidden="true">
          <span className="hotel-facade__quietRule" />
        </p>
      </div>
    );
  }
  const occupant = props.slot.occupant;
  const roomLabel =
    props.slot.room === 1
      ? `Penthouse · Room 01${props.you ? " · YOU" : ""}`
      : `Room ${props.slot.room}${props.you ? " · YOU" : ""}`;
  return (
    <div className="hotel-facade__foot" data-testid="selected-room" aria-live="polite">
      <p className="hotel-facade__selected">
        <span className="hotel-facade__selectedRoom">{roomLabel}</span>
        <span className="hotel-facade__selectedSep" aria-hidden="true" />
        {occupant ? (
          <>
            <span className="hotel-mono">{shortenAddress(occupant.address)}</span>
            <span className="hotel-facade__selectedSep" aria-hidden="true" />
            <span className="hotel-mono">{formatRawUnits(occupant.balanceRaw)} HOTEL</span>
            <span className="hotel-facade__selectedSep" aria-hidden="true" />
            <span>Rank #{props.slot.room}</span>
          </>
        ) : (
          <span className="hotel-facade__selectedVacant">Unoccupied</span>
        )}
      </p>
    </div>
  );
}

/** @deprecated Prefer LobbySheet; retained for call-site clarity during the structure port. */
export function LobbyQueue(props: {
  lobby: LobbyGuest[];
  door: Occupant | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LobbySheet open={props.open} guests={props.lobby} door={props.door} onClose={props.onClose} />
  );
}

export function LobbySheet(props: {
  open: boolean;
  guests: LobbyGuest[];
  door: Occupant | null;
  onClose: () => void;
}) {
  if (!props.open) return null;
  const shown = props.guests.slice(0, 8);

  return (
    <div className="hotel-lobby" role="dialog" aria-modal="true" aria-label="The Lobby">
      <button
        type="button"
        className="hotel-lobby__scrim"
        aria-label="Close the lobby"
        onClick={props.onClose}
      />
      <div className="hotel-lobby__sheet">
        <div className="hotel-lobby__head">
          <h2 className="hotel-panel__title">The Lobby</h2>
          <button type="button" className="hotel-lobby__close" onClick={props.onClose}>
            Close
          </button>
        </div>
        <p className="hotel-lobby__lead">
          {props.door === null
            ? "Rank #101 and below. Room 100 is vacant — the lobby is the queue for the entrance."
            : `Rank #101 and below. Room 100 holds ${formatRawUnits(props.door.balanceRaw)} HOTEL. No room, no Room Service — the shortest way up is Room 100.`}
        </p>
        {shown.length === 0 ? <p className="hotel-lobby__empty">The lobby is clear.</p> : null}
        <ul className="hotel-lobby__list">
          {shown.map((guest) => {
            const gap =
              props.door === null
                ? null
                : additionalNeededToBeatTarget({
                    userAddress: guest.address,
                    userBalance: guest.balanceRaw,
                    targetAddress: props.door.address,
                    targetBalance: props.door.balanceRaw,
                  });
            return (
              <li className="hotel-lobby__row" key={guest.address}>
                <span className="hotel-mono hotel-lobby__rank">#{guest.rank}</span>
                <span className="hotel-mono hotel-lobby__wallet">
                  {shortenAddress(guest.address)}
                </span>
                <span className="hotel-mono hotel-lobby__balance">
                  {formatRawUnits(guest.balanceRaw)} HOTEL
                </span>
                <span className="hotel-lobby__gap">
                  {gap === null ? "Room 100 vacant" : `+${formatRawUnits(gap)} to Room 100`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function RoomServicePanel(props: {
  state: "delayed" | "arriving" | "waiting" | "none";
  claimableWei: bigint;
  clock: string;
  minuteLabel: string;
  claimDisabled: boolean;
  claimNote: string;
  connected: boolean;
  onClaim: () => void;
}) {
  const stateClass =
    props.state === "delayed" ? "delayed" : props.state === "arriving" ? "arriving" : "waiting";
  const stateLabel =
    props.state === "delayed"
      ? "DELAYED"
      : props.state === "arriving"
        ? "ARRIVING"
        : props.state === "waiting"
          ? "WAITING"
          : "NONE";

  return (
    <section className="hotel-panel hotel-service" aria-labelledby="room-service-heading">
      <div className="hotel-panel__head hotel-panel__head--icon">
        <span className="hotel-service__bell" aria-hidden="true">
          <BellIcon />
        </span>
        <h2 id="room-service-heading" className="hotel-panel__title">
          Room Service
        </h2>
      </div>

      <p className="hotel-service__lead">The pool awaits</p>

      <div className={`hotel-service__amount hotel-service__amount--${stateClass}`}>
        <span className="hotel-mono hotel-service__value">
          {props.connected ? formatEthFromWei(props.claimableWei) : "—.——"}
          <span className="hotel-service__unit">ETH</span>
        </span>
        <span className="hotel-service__state">{stateLabel}</span>
      </div>

      <button
        type="button"
        className="hotel-btn hotel-btn--claim"
        disabled={props.claimDisabled}
        onClick={props.onClaim}
      >
        Claim Room Service
      </button>
      <p className="hotel-service__note">
        {props.claimNote
          ? props.claimNote
          : props.connected
            ? "Every 15 minutes. Split pro rata across the eligible top 100 at the financial snapshot. Displayed guests are not that snapshot."
            : "Connect a wallet to view your entitlement."}
      </p>

      <dl className="hotel-service__facts">
        <div className="hotel-service__fact">
          <ClockIcon className="hotel-service__factIcon" />
          <div>
            <dt>Next service</dt>
            <dd className="hotel-mono" aria-hidden="true">
              {props.clock}
            </dd>
            <p className="sr-only">Next Room Service {props.minuteLabel}</p>
          </div>
        </div>
        <div className="hotel-service__fact">
          <LedgerIcon className="hotel-service__factIcon" />
          <div>
            <dt>Last service</dt>
            <dd className="hotel-mono">
              — <span className="hotel-service__factUnit">ETH</span>
            </dd>
          </div>
        </div>
      </dl>

      <blockquote className="hotel-service__quote">
        <p>“Same guests.</p>
        <p>Bigger stays.”</p>
        <cite>HOTEL100</cite>
      </blockquote>
    </section>
  );
}

export function LiveActivity(props: { items: ActivityItem[]; nowMs: number | null }) {
  const now = props.nowMs ?? 0;
  return (
    <section className="hotel-panel hotel-activity" aria-labelledby="activity-heading">
      <div className="hotel-activity__head">
        <h2 id="activity-heading" className="hotel-panel__title hotel-activity__title">
          <i className="hotel-dot" aria-hidden="true" />
          Live Activity
        </h2>
        <span className="hotel-activity__sub">Real-time hotel activity</span>
        <span className="hotel-activity__all">
          All activity
          <ArrowRightIcon className="hotel-activity__allIcon" />
        </span>
      </div>

      {props.items.length === 0 ? (
        <p className="hotel-activity__empty">No public stays yet.</p>
      ) : (
        <ul className="hotel-activity__list">
          {props.items.map((item) => {
            const Icon = ACTIVITY_ICONS[item.kind];
            return (
              <li className="hotel-activity__row" key={item.id}>
                <time
                  className="hotel-mono hotel-activity__time"
                  dateTime={new Date(item.atMs).toISOString()}
                >
                  {formatActivityClock(item.atMs)}
                </time>
                <span
                  className={`hotel-activity__icon is-${ACTIVITY_ICON_CLASS[item.kind]}`}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <span className="hotel-activity__text hotel-mono">{item.summary}</span>
                <span className="hotel-activity__ago">
                  {props.nowMs === null ? "—" : formatRelativeTime(item.atMs, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function HotelMarketStrip(props: { market: HotelSnapshot["market"] }) {
  const unavailable = <span className="hotel-market__unavailable">Not published</span>;
  const holders =
    props.market.holders === null ? (
      unavailable
    ) : (
      <span className="hotel-mono">{props.market.holders}</span>
    );

  return (
    <section className="hotel-panel hotel-market" aria-labelledby="market-heading">
      <h2 id="market-heading" className="hotel-market__title">
        <MarketIcon className="hotel-market__icon" />
        Hotel Market
      </h2>

      <span className="hotel-market__rule" aria-hidden="true" />

      <dl className="hotel-market__figures">
        <div className="hotel-market__figure">
          <dt>$HOTEL</dt>
          <dd>{props.market.price === null ? unavailable : props.market.price}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>MC</dt>
          <dd>{props.market.marketCap === null ? unavailable : props.market.marketCap}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>LIQ</dt>
          <dd>{props.market.liquidity === null ? unavailable : props.market.liquidity}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>Holders</dt>
          <dd>{holders}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="hotel-btn hotel-btn--trade"
        disabled
        title="No trade destination is published by the hotel state API"
      >
        Trade $HOTEL
        <ArrowRightIcon className="hotel-btn__icon" />
      </button>
    </section>
  );
}

export function HotelFooter(props: { onOpenLobby: () => void }) {
  return (
    <footer className="hotel-footer">
      <span className="hotel-footer__brand">HOTEL100</span>
      <span className="hotel-footer__sep" aria-hidden="true" />
      <span className="hotel-footer__tag">100 rooms. No reservations.</span>
      <button type="button" className="hotel-footer__lobby" onClick={props.onOpenLobby}>
        Enter the Lobby
      </button>
      <span className="hotel-footer__motto">A higher kind of stay.</span>
    </footer>
  );
}
