import Image from "next/image";
import { formatEthFromWei, formatRawUnits, formatStayDuration, shortenAddress } from "../format";
import type { HeaderStatus } from "../present";
import type { ActivityItem, GuestStayView, HotelSnapshot, LobbyGuest, RoomSlot } from "../types";

const HOTEL_LOGO_SRC = "/brand/hotel100-logo3.png";

function ServiceBell(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20 5.5c1.1 0 2 .9 2 2v1.2c5.2.7 9.2 5.1 9.2 10.4v1.1H8.8v-1.1c0-5.3 4-9.7 9.2-10.4V7.5c0-1.1.9-2 2-2z"
      />
      <path
        fill="currentColor"
        d="M7.2 21.2h25.6c.9 0 1.5.8 1.3 1.6-.7 2.4-2.8 4.3-5.4 5.1H11.3c-2.6-.8-4.7-2.7-5.4-5.1-.2-.8.4-1.6 1.3-1.6z"
      />
      <rect fill="currentColor" x="9" y="29.2" width="22" height="3.2" rx="1.2" />
      <circle fill="currentColor" cx="20" cy="5.2" r="2.2" />
    </svg>
  );
}

export function HotelHeader(props: {
  status: HeaderStatus;
  serviceLabel: string;
  walletLabel: string;
  onConnect: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <ServiceBell className="brand-bell" />
        <Image
          className="brand-logo"
          src={HOTEL_LOGO_SRC}
          alt="HOTEL100"
          width={2172}
          height={724}
          priority
        />
        <div className="brand-copy">
          <span className="tagline">100 rooms. No reservations.</span>
        </div>
      </div>
      <div className="top-spacer" />
      <div className="status">
        <span className={`dot ${props.status.tone}`} />
        <span>{props.status.label}</span>
      </div>
      <div className="service-chip">
        SERVICE <span>{props.serviceLabel}</span>
      </div>
      <button type="button" className="wallet-btn" onClick={props.onConnect}>
        {props.walletLabel}
      </button>
    </header>
  );
}

export function HotelOperationalState(props: { status: HeaderStatus; current: boolean }) {
  if (props.current && props.status.tone === "live") return null;
  if (props.status.tone === "soon") {
    return (
      <p className="op-banner">Check-in has not opened. Rooms stay vacant until HOTEL is live.</p>
    );
  }
  if (!props.current) {
    return (
      <p className="op-banner" role="status">
        {props.status.label}. Indexed room assignments are not current.
      </p>
    );
  }
  if (props.status.tone === "delayed" || props.status.tone === "arriving") {
    return (
      <p className={`op-banner ${props.status.tone}`} role="status">
        {props.status.label}
      </p>
    );
  }
  return null;
}

export function YourStayPanel(props: { stay: GuestStayView; nowMs: number | null }) {
  const stay = props.stay;
  return (
    <aside className="panel stay-panel">
      <div className="panel-head">Your Stay</div>
      <div className="stay-body">
        {stay.kind === "prelive" || stay.kind === "disconnected" ? (
          <>
            <div className="kicker">Visitor</div>
            <div className="big-room">—</div>
            <p className="quiet">Connect a wallet after check-in opens to see your room.</p>
          </>
        ) : null}
        {stay.kind === "not_checked_in" ? (
          <>
            <div className="kicker">Former guest</div>
            <div className="big-room">NOT CHECKED IN</div>
            <p className="quiet">History and claimable Room Service remain.</p>
            <div className="meta">
              <div className="mini">
                <div className="stat-label">Best room</div>
                <strong>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</strong>
              </div>
              <div className="mini">
                <div className="stat-label">Waiting</div>
                <strong>{formatEthFromWei(stay.claimableWei)} ETH</strong>
              </div>
            </div>
          </>
        ) : null}
        {stay.kind === "checked_in" ? (
          <>
            <div className="kicker">Currently checked in</div>
            <div className="big-room">ROOM {stay.room}</div>
            <div className="rank">RANK #{stay.rank}</div>
            <div className="stat">
              <div className="stat-label">Your balance</div>
              <div className="stat-value">{formatRawUnits(stay.balanceRaw)} HOTEL</div>
            </div>
            {stay.targetRoom === null ? (
              <div className="move">
                <strong>PENTHOUSE</strong>
                <span>Top of the hotel</span>
              </div>
            ) : (
              <div className="move">
                <strong>+{formatRawUnits(stay.additionalNeededRaw)} HOTEL</strong>
                <span>to move into Room {stay.targetRoom}</span>
              </div>
            )}
            <div className="meta">
              <div className="mini">
                <div className="stat-label">Checked in</div>
                <strong>
                  {props.nowMs === null || stay.checkedInSinceMs === null
                    ? "—"
                    : formatStayDuration(stay.checkedInSinceMs, props.nowMs)}
                </strong>
              </div>
              <div className="mini">
                <div className="stat-label">Best room</div>
                <strong>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</strong>
              </div>
            </div>
          </>
        ) : null}
        {stay.kind === "lobby" ? (
          <>
            <div className="kicker">You&apos;re in the lobby</div>
            <div className="big-room">RANK #{stay.rank}</div>
            <div className="stat">
              <div className="stat-label">Your balance</div>
              <div className="stat-value">{formatRawUnits(stay.balanceRaw)} HOTEL</div>
            </div>
            <div className="move">
              {stay.additionalNeededRaw === null ? (
                <>
                  <strong>ROOM 100 IS VACANT</strong>
                  <span>A top-100 balance checks in</span>
                </>
              ) : (
                <>
                  <strong>+{formatRawUnits(stay.additionalNeededRaw)} HOTEL</strong>
                  <span>
                    to check into Room 100
                    {stay.room100BalanceRaw === null
                      ? ""
                      : ` · door holds ${formatRawUnits(stay.room100BalanceRaw)}`}
                  </span>
                </>
              )}
            </div>
            <div className="meta">
              <div className="mini">
                <div className="stat-label">Best room</div>
                <strong>{stay.bestRoom === null ? "—" : `#${stay.bestRoom}`}</strong>
              </div>
              <div className="mini">
                <div className="stat-label">Waiting</div>
                <strong>{formatEthFromWei(stay.claimableWei)} ETH</strong>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function roomLabel(slot: RoomSlot, you: boolean, selected: boolean): string {
  const who = slot.occupant ? "occupied" : "vacant";
  return `Room ${slot.room}, ${who}${you ? ", your room" : ""}${selected ? ", selected" : ""}`;
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
  const standard = props.snapshot.rooms.filter((slot) => slot.room >= 2);
  const selected = props.snapshot.rooms.find((slot) => slot.room === props.selectedRoom) ?? null;
  return (
    <section className="panel facade-panel" data-testid="hotel-facade">
      <div className="hotel-toolbar">
        <div className="title">The Hotel</div>
        <div className="spacer" />
        <div className="jump">
          <button type="button" onClick={() => props.onSelect(1)}>
            TOP
          </button>
          <button
            type="button"
            onClick={() => props.youRoom && props.onSelect(props.youRoom)}
            disabled={props.youRoom === null}
          >
            MY ROOM
          </button>
          <button type="button" onClick={() => props.onSelect(100)}>
            ROOM 100
          </button>
        </div>
      </div>
      <div className={`hotel-stage${props.stale ? " stale" : ""}`}>
        <div className="building">
          <div className="parapet">
            <div className="parapet-pediment" aria-hidden="true" />
            <div className="parapet-cap" aria-hidden="true" />
            <ServiceBell className="parapet-bell" />
            <h1 className="hotel-name">
              <Image
                className="parapet-logo"
                src={HOTEL_LOGO_SRC}
                alt="HOTEL100"
                width={2172}
                height={724}
                priority
              />
            </h1>
            <p className="parapet-tagline">A Higher Kind of Stay.</p>
          </div>
          {penthouse ? (
            <button
              id="room-1"
              type="button"
              className={[
                "penthouse",
                penthouse.occupant ? "occupied" : "vacant",
                props.youRoom === 1 ? "you" : "",
                props.selectedRoom === 1 ? "selected" : "",
                props.penthouseMotion ? "motion-takeover" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={props.selectedRoom === 1}
              aria-label={roomLabel(
                penthouse,
                props.youRoom === 1,
                props.selectedRoom === 1,
              ).replace("Room 1", "Penthouse, room 1")}
              onClick={() => props.onSelect(1)}
            >
              <span className="ph-plate">
                <span className="ph-label">PENTHOUSE</span>
              </span>
              <span className="ph-windows" aria-hidden="true">
                <span className="ph-light">
                  <span className="ph-glow" />
                </span>
                <span className="ph-light">
                  <span className="ph-glow" />
                </span>
                <span className="ph-light">
                  <span className="ph-glow" />
                </span>
              </span>
              <span className="ph-room-plaque">
                <span className="ph-room-kicker">ROOM</span>
                <span className="ph-num">01</span>
              </span>
              <span className="ph-plaque">
                <span className="ph-wallet">
                  {penthouse.occupant ? shortenAddress(penthouse.occupant.address) : "—"}
                </span>
                <span className="ph-bal">
                  {penthouse.occupant
                    ? `${formatRawUnits(penthouse.occupant.balanceRaw)} HOTEL`
                    : "—"}
                </span>
              </span>
            </button>
          ) : null}
          <div className={`facade${props.arriving ? " arriving" : ""}`}>
            <section className="room-grid" aria-label="Rooms 2 through 100">
              {standard.map((slot) => {
                const you = props.youRoom === slot.room;
                const selectedRoom = props.selectedRoom === slot.room;
                return (
                  <button
                    key={slot.room}
                    id={`room-${slot.room}`}
                    type="button"
                    data-room={slot.room}
                    className={[
                      "room",
                      slot.occupant ? "occupied" : "vacant",
                      you ? "you" : "",
                      selectedRoom ? "selected" : "",
                      props.lightRooms.includes(slot.room) ? "motion-light" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={selectedRoom}
                    aria-label={roomLabel(slot, you, selectedRoom)}
                    onClick={() => props.onSelect(slot.room)}
                  >
                    <span className="glazing" aria-hidden="true">
                      <span className="mullion-x" />
                      <span className="mullion-y" />
                      <span className="pane" />
                      <span className="pane" />
                      <span className="pane" />
                      <span className="pane" />
                      <span className="glass-sheen" />
                    </span>
                    <span className="plaque">
                      <span className="num">{String(slot.room).padStart(2, "0")}</span>
                    </span>
                  </button>
                );
              })}
            </section>
            <div
              className={`entrance${props.entranceMotion ? " motion-checkin" : ""}`}
              aria-hidden="true"
            >
              <div className="entrance-canopy">
                <span className="canopy-dome" />
                <span className="canopy-valence">HOTEL100</span>
              </div>
              <div className="entrance-bay">
                <span className="entrance-lantern">
                  <span className="lantern-glow" />
                </span>
                <div className="doorway">
                  <span className="leaf">
                    <span className="door-glass" />
                    <span className="door-handle" />
                  </span>
                  <span className="leaf">
                    <span className="door-glass" />
                    <span className="door-handle" />
                  </span>
                </div>
                <span className="entrance-lantern">
                  <span className="lantern-glow" />
                </span>
              </div>
              <div className="entrance-forecourt">
                <span className="planter" />
                <span className="entrance-spill" />
                <span className="planter" />
              </div>
            </div>
          </div>
          <div className="plinth" aria-hidden="true" />
        </div>
        <SelectedRoomSummary slot={selected} you={props.youRoom === props.selectedRoom} />
      </div>
    </section>
  );
}

export function SelectedRoomSummary(props: { slot: RoomSlot | null; you: boolean }) {
  if (!props.slot) {
    return (
      <div className="selection" aria-live="polite">
        <div className="name">Select a room</div>
      </div>
    );
  }
  const occupant = props.slot.occupant;
  const title =
    props.slot.room === 1
      ? `PENTHOUSE${props.you ? " · YOU" : ""}`
      : `ROOM ${String(props.slot.room).padStart(2, "0")}${props.you ? " · YOU" : ""}`;
  return (
    <div className="selection" aria-live="polite" data-testid="selected-room">
      <div>
        <div className="stat-label">Selected room</div>
        <div className="name">
          {title}
          {occupant ? ` · ${shortenAddress(occupant.address)}` : " · VACANT"}
        </div>
      </div>
      <div className="right">{occupant ? `${formatRawUnits(occupant.balanceRaw)} HOTEL` : "—"}</div>
    </div>
  );
}

export function LobbyQueue(props: { lobby: LobbyGuest[]; doorBalance: bigint | null }) {
  const shown = props.lobby.slice(0, 8);
  return (
    <aside className="panel lobby-panel">
      <div className="panel-head">Lobby</div>
      <div className="lobby-body">
        <p className="lobby-note">
          {props.doorBalance === null
            ? "Room 100 is vacant. The lobby is the queue for the entrance."
            : `Room 100 holds ${formatRawUnits(props.doorBalance)} HOTEL. Ranks from 101 wait at the door.`}
        </p>
        {shown.length === 0 ? <p className="quiet">The lobby is clear.</p> : null}
        {shown.map((guest) => (
          <div className="lobby-row" key={guest.address}>
            <span>#{guest.rank}</span>
            <span>{shortenAddress(guest.address)}</span>
            <span>{formatRawUnits(guest.balanceRaw)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function RoomServicePanel(props: {
  state: "delayed" | "arriving" | "waiting" | "none";
  claimableWei: bigint;
  clock: string;
  minuteLabel: string;
  claimDisabled: boolean;
  claimNote: string;
  onClaim: () => void;
}) {
  const label =
    props.state === "delayed"
      ? "ROOM SERVICE DELAYED"
      : props.state === "arriving"
        ? "ROOM SERVICE ARRIVING"
        : props.state === "waiting"
          ? "ROOM SERVICE WAITING"
          : "NO ROOM SERVICE WAITING";
  return (
    <aside className="panel service-panel">
      <div className="panel-head">Room Service</div>
      <div className="service-body">
        <div>
          <div className="kicker">For the connected guest</div>
          <div className="service-amount">{formatEthFromWei(props.claimableWei)} ETH</div>
          <div className={`waiting${props.state === "delayed" ? " delayed" : ""}`}>{label}</div>
        </div>
        <button
          type="button"
          className="claim"
          disabled={props.claimDisabled}
          onClick={props.onClaim}
        >
          CLAIM ROOM SERVICE
        </button>
        {props.claimNote ? <p className="claim-note">{props.claimNote}</p> : null}
        <div className="countdown">
          <div className="stat-label">Next service</div>
          <div className="countdown-time" aria-hidden="true">
            {props.clock}
          </div>
          <p className="sr-only">Next Room Service {props.minuteLabel}</p>
          <p className="service-note">
            Every 15 minutes. Split pro rata across the eligible top 100 at the financial snapshot.
            Displayed guests are not that snapshot.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function LiveActivity(props: { items: ActivityItem[] }) {
  return (
    <section className="activity">
      <div className="section-title">Live activity</div>
      <div className="activity-list">
        {props.items.length === 0 ? (
          <p className="quiet" style={{ padding: "12px 0" }}>
            No public stays yet.
          </p>
        ) : null}
        {props.items.map((item) => (
          <div className="activity-row" key={item.id}>
            <time dateTime={new Date(item.atMs).toISOString()}>
              {new Date(item.atMs).toISOString().slice(11, 19)}
            </time>
            <span>{item.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HotelMarketStrip(props: { market: HotelSnapshot["market"] }) {
  const cells: Array<[string, string]> = [
    ["Token", props.market.tokenLabel],
    ["Price", props.market.price ?? "—"],
    ["Market cap", props.market.marketCap ?? "—"],
    ["Liquidity", props.market.liquidity ?? "—"],
    ["Holders", props.market.holders ?? "—"],
  ];
  return (
    <section className="market">
      <div className="section-title">Hotel market</div>
      <div className="market-row">
        {cells.map(([label, value]) => (
          <div className="market-cell" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <button type="button" className="trade" disabled>
          BUY / TRADE
        </button>
      </div>
    </section>
  );
}
