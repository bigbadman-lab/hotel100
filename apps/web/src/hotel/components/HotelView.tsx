import { formatEthFromWei, formatRawUnits, formatStayDuration, shortenAddress } from "../format";
import type { HeaderStatus } from "../present";
import type { ActivityItem, GuestStayView, HotelSnapshot, LobbyGuest, RoomSlot } from "../types";

function BellMark() {
  return (
    <svg className="mark" viewBox="0 0 34 34" aria-hidden="true">
      <rect x="0.5" y="0.5" width="33" height="33" fill="none" stroke="currentColor" />
      <path
        d="M17 8c-3 0-5 2.2-5 5.2V18l-1.4 2.2h12.8L22 18v-4.8C22 10.2 20 8 17 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M15.2 21.5a1.8 1.8 0 0 0 3.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
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
        <BellMark />
        <div className="brand-copy">
          <strong>HOTEL100</strong>
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
        <h1 className="hotel-name">HOTEL100</h1>
        <div className="roof" />
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
            aria-label={roomLabel(penthouse, props.youRoom === 1, props.selectedRoom === 1).replace(
              "Room 1",
              "Penthouse, room 1",
            )}
            onClick={() => props.onSelect(1)}
          >
            <div>
              <div className="ph-label">PENTHOUSE</div>
              <div className="ph-num">01</div>
            </div>
            <div className="ph-wallet">
              {penthouse.occupant ? shortenAddress(penthouse.occupant.address) : "VACANT"}
            </div>
            <div className="ph-bal">
              {penthouse.occupant ? `${formatRawUnits(penthouse.occupant.balanceRaw)} HOTEL` : "—"}
            </div>
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
                  <span className="num">{String(slot.room).padStart(2, "0")}</span>
                  {slot.occupant ? null : <span className="vac">VAC</span>}
                </button>
              );
            })}
          </section>
          <div
            className={`entrance${props.entranceMotion ? " motion-checkin" : ""}`}
            aria-hidden="true"
          >
            <div className="door" />
          </div>
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
