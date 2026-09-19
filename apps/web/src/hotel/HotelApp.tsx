"use client";

import { type Address, normalizeAddress, ROOM_POLL_INTERVAL_MS } from "@hotel100/domain";
import { useEffect, useRef, useState } from "react";
import {
  approveExactHotel,
  checkInUiAfterSubmit,
  executeCheckIn,
  executeCheckOut,
  readStayFromContract,
} from "./check-in-tx";
import { claimUiAfterSubmit, type EthereumRequest, executeRoomServiceClaim } from "./claim";
import {
  HotelFacade,
  HotelFooter,
  HotelHeader,
  HotelMarketStrip,
  HotelOperationalState,
  LiveActivity,
  LobbySheet,
  RoomServicePanel,
  YourStayPanel,
} from "./components/HotelView";
import { formatServiceClock, shortenAddress } from "./format";
import { arrivingCue, diffHotelMotion, type MotionCue } from "./motion";
import {
  connectedRoom,
  isRoomServiceArriving,
  occupantAt,
  presentHeaderStatus,
  roomServicePanelState,
  roomsAreCurrent,
  secondsUntilNextService,
} from "./present";
import { failClosedProductionSnapshot, fetchProductionSnapshot } from "./production-client";
import { loadHotelSnapshot } from "./source";
import type { FixtureScenario, HotelMode, HotelSnapshot } from "./types";

export function HotelApp(props: {
  mode: HotelMode;
  hotelLive: boolean;
  scenario: FixtureScenario;
  roomServiceAddress: Address | null;
  hotelTokenAddress: Address | null;
}) {
  const initial =
    props.mode === "fixture"
      ? loadHotelSnapshot({
          mode: "fixture",
          hotelLive: props.hotelLive,
          scenario: props.scenario,
        })
      : failClosedProductionSnapshot();
  const [snapshot, setSnapshot] = useState<HotelSnapshot>(initial);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState(() =>
    initial.stay.kind === "checked_in" ? initial.stay.room : 1,
  );
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [cues, setCues] = useState<MotionCue[]>([]);
  const [walletOverride, setWalletOverride] = useState<Address | null>(null);
  const [claimNote, setClaimNote] = useState("");
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [wasArriving, setWasArriving] = useState(false);
  const snapshotRef = useRef(initial);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next =
        props.mode === "fixture"
          ? loadHotelSnapshot({
              mode: "fixture",
              hotelLive: props.hotelLive,
              scenario: props.scenario,
            })
          : await fetchProductionSnapshot(walletOverride);
      if (cancelled) return;
      const motion = diffHotelMotion(snapshotRef.current, next);
      snapshotRef.current = next;
      setSnapshot(next);
      if (motion.length > 0) {
        setCues(motion);
        window.setTimeout(() => setCues([]), 360);
      }
    };
    refreshRef.current = load;
    setNowMs(Date.now());
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    void load();
    const poll = setInterval(() => {
      void load();
    }, ROOM_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [props.mode, props.hotelLive, props.scenario, walletOverride]);

  const nowSeconds = nowMs === null ? null : Math.floor(nowMs / 1000);
  const arriving =
    nowSeconds !== null && isRoomServiceArriving(nowSeconds, snapshot.roomServiceDelayed);
  useEffect(() => {
    const extra = arrivingCue(wasArriving, arriving);
    if (extra.length > 0) setCues((current) => [...current, ...extra]);
    setWasArriving(arriving);
  }, [arriving, wasArriving]);

  const status = presentHeaderStatus({
    hotelLive: snapshot.hotelLive,
    fixturePreview: snapshot.fixturePreview,
    canaryPending: snapshot.canaryPending,
    lastIndexedAtMs: snapshot.lastIndexedAtMs,
    nowMs: nowMs ?? 0,
    roomServiceDelayed: snapshot.roomServiceDelayed,
    arriving,
  });
  const current = roomsAreCurrent({
    hotelLive: snapshot.hotelLive,
    fixturePreview: snapshot.fixturePreview,
    lastIndexedAtMs: snapshot.lastIndexedAtMs,
    nowMs: nowMs ?? 0,
  });
  const youRoom = connectedRoom(snapshot);
  const claimable = claimableOf(snapshot);
  const serviceState = roomServicePanelState({
    delayed: snapshot.roomServiceDelayed,
    arriving,
    claimableWei: claimable,
  });
  const remaining = nowSeconds === null ? null : secondsUntilNextService(nowSeconds);
  const clock =
    remaining === null ? "--:--" : remaining === 0 ? "00:00" : formatServiceClock(remaining);
  const headerService =
    serviceState === "delayed" ? "DELAYED" : serviceState === "arriving" ? "ARRIVING" : clock;
  const wallet = walletOverride ?? snapshot.connectedWallet;
  const door = occupantAt(snapshot.rooms, 100);

  async function onConnect() {
    if (snapshot.connectedWallet && !walletOverride) return;
    const provider = (window as unknown as { ethereum?: EthereumRequest }).ethereum;
    if (!provider) return;
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const first = accounts[0];
      if (first) setWalletOverride(normalizeAddress(first));
    } catch {
      setWalletOverride(null);
    }
  }

  async function onClaim() {
    if (!wallet) {
      setClaimNote("Connect a wallet. Nothing was broadcast.");
      return;
    }
    if (claimable <= 0n) {
      setClaimNote("Nothing to claim.");
      return;
    }
    if (!snapshot.fixturePreview && !props.roomServiceAddress) {
      setClaimNote("Room Service is not configured. Nothing was broadcast.");
      return;
    }
    const provider = (window as unknown as { ethereum?: EthereumRequest }).ethereum;
    if (!provider) {
      setClaimNote("No injected wallet. Nothing was broadcast.");
      return;
    }
    setClaimNote("Confirm the claim in your wallet.");
    try {
      const sent = await executeRoomServiceClaim({
        origin: window.location.origin,
        account: wallet,
        provider,
        roomServiceAddress: props.roomServiceAddress,
        claimableWei: claimable,
        signMessage: async (message) => {
          const signature = await provider.request({
            method: "personal_sign",
            params: [message, wallet],
          });
          if (typeof signature !== "string" || !signature.startsWith("0x")) {
            throw new Error("rejected");
          }
          return signature as `0x${string}`;
        },
      });
      const ui = claimUiAfterSubmit({ result: sent, claimableWei: claimable });
      setClaimNote(ui.note);
      if (ui.refresh) await refreshRef.current();
    } catch {
      setClaimNote("The claim was not confirmed. Your claimable amount is unchanged.");
    }
  }

  async function withWalletProvider(): Promise<{
    provider: EthereumRequest;
    account: Address;
  } | null> {
    if (!wallet) {
      setCheckInNote("Connect a wallet. Nothing was broadcast.");
      return null;
    }
    const provider = (window as unknown as { ethereum?: EthereumRequest }).ethereum;
    if (!provider) {
      setCheckInNote("No injected wallet. Nothing was broadcast.");
      return null;
    }
    return { provider, account: wallet };
  }

  async function onApproveCheckIn(amount: bigint) {
    const ctx = await withWalletProvider();
    if (!ctx) return;
    if (!props.roomServiceAddress || !props.hotelTokenAddress) {
      setCheckInNote("Room Service is not configured. Nothing was broadcast.");
      return;
    }
    setCheckInBusy(true);
    setCheckInNote("Confirm the exact HOTEL approval in your wallet.");
    try {
      const result = await approveExactHotel({
        provider: ctx.provider,
        account: ctx.account,
        token: props.hotelTokenAddress,
        spender: props.roomServiceAddress,
        amount,
      });
      setCheckInNote(
        result.ok ? "Approval confirmed. You can check in." : checkInUiAfterSubmit(result).note,
      );
    } catch {
      setCheckInNote("Approval was not confirmed.");
    } finally {
      setCheckInBusy(false);
    }
  }

  async function onCheckIn(amount: bigint) {
    if (!snapshot.checkInEnabled) {
      setCheckInNote("Check-in is not enabled.");
      return;
    }
    const ctx = await withWalletProvider();
    if (!ctx) return;
    setCheckInBusy(true);
    setCheckInNote("Confirm check-in in your wallet.");
    try {
      const result = await executeCheckIn({
        origin: window.location.origin,
        account: ctx.account,
        provider: ctx.provider,
        roomServiceAddress: props.roomServiceAddress,
        hotelTokenAddress: props.hotelTokenAddress,
        amount,
        signMessage: async (message) => {
          const signature = await ctx.provider.request({
            method: "personal_sign",
            params: [message, ctx.account],
          });
          if (typeof signature !== "string" || !signature.startsWith("0x")) {
            throw new Error("rejected");
          }
          return signature as `0x${string}`;
        },
      });
      const ui = checkInUiAfterSubmit(result);
      setCheckInNote(ui.note);
      if (ui.refresh) {
        setCheckInNote("Confirmed. Waiting for hotel state…");
        await refreshRef.current();
      }
    } catch {
      setCheckInNote("Check-in was not confirmed.");
    } finally {
      setCheckInBusy(false);
    }
  }

  async function onCheckOut() {
    const ctx = await withWalletProvider();
    if (!ctx) return;
    setCheckInBusy(true);
    setCheckInNote("Confirm check-out in your wallet.");
    try {
      if (props.roomServiceAddress) {
        const onchain = await readStayFromContract({
          provider: ctx.provider,
          roomServiceAddress: props.roomServiceAddress,
          guest: ctx.account,
        });
        if (onchain && onchain.amount > 0n) {
          const now = Math.floor(Date.now() / 1000);
          if (Number(onchain.unlockTimestamp) > now) {
            setCheckInNote("Stay is still locked.");
            setCheckInBusy(false);
            return;
          }
        }
      }
      const result = await executeCheckOut({
        account: ctx.account,
        provider: ctx.provider,
        roomServiceAddress: props.roomServiceAddress,
      });
      const ui = checkInUiAfterSubmit(result);
      setCheckInNote(ui.note);
      if (ui.refresh) await refreshRef.current();
    } catch {
      setCheckInNote("Check-out was not confirmed.");
    } finally {
      setCheckInBusy(false);
    }
  }

  const lightRooms = cues.flatMap((cue) => (cue.kind === "occupant-light" ? [cue.room] : []));
  return (
    <div
      className="hotel-shell"
      data-hotel-mode={snapshot.source}
      data-hotel-live={snapshot.hotelLive ? "true" : "false"}
    >
      <HotelHeader
        status={status}
        serviceLabel={headerService}
        walletLabel={wallet ? shortenAddress(wallet) : "Connect Wallet"}
        onConnect={() => void onConnect()}
      />
      <HotelOperationalState
        status={status}
        current={current || snapshot.fixturePreview}
        checkedInCount={snapshot.activeCheckedInTop100Count}
      />
      <main className="hotel-main">
        <div className="hotel-grid">
          <YourStayPanel
            stay={snapshot.stay}
            nowMs={nowMs}
            wallet={wallet}
            onConnect={() => void onConnect()}
            onFocusRoom={() => {
              if (youRoom !== null) setSelectedRoom(youRoom);
            }}
            checkInEnabled={snapshot.checkInEnabled}
            checkInNote={checkInNote}
            checkInBusy={checkInBusy}
            onApproveCheckIn={(amount) => void onApproveCheckIn(amount)}
            onCheckIn={(amount) => void onCheckIn(amount)}
            onCheckOut={() => void onCheckOut()}
          />
          <HotelFacade
            snapshot={snapshot}
            selectedRoom={selectedRoom}
            youRoom={youRoom}
            stale={!current && snapshot.hotelLive}
            arriving={
              cues.some((cue) => cue.kind === "room-service-arriving") ||
              serviceState === "arriving"
            }
            lightRooms={lightRooms}
            penthouseMotion={cues.some((cue) => cue.kind === "penthouse-takeover")}
            entranceMotion={cues.some((cue) => cue.kind === "check-in-100")}
            onSelect={setSelectedRoom}
          />
          <RoomServicePanel
            state={serviceState}
            claimableWei={claimable}
            clock={serviceState === "arriving" ? "ARRIVING" : clock}
            minuteLabel={
              serviceState === "arriving"
                ? "is arriving"
                : remaining === null
                  ? "time is loading"
                  : `in ${Math.ceil((remaining ?? 0) / 60)} minutes`
            }
            claimDisabled={
              claimable <= 0n ||
              serviceState === "none" ||
              (!snapshot.fixturePreview && !snapshot.hotelLive) ||
              (!snapshot.fixturePreview && !props.roomServiceAddress)
            }
            claimNote={claimNote}
            connected={wallet !== null}
            onClaim={() => void onClaim()}
          />
        </div>
        <LiveActivity items={snapshot.activity} nowMs={nowMs} />
        <HotelMarketStrip market={snapshot.market} />
      </main>
      <HotelFooter onOpenLobby={() => setLobbyOpen(true)} />
      <LobbySheet
        open={lobbyOpen}
        guests={snapshot.lobby}
        door={door}
        onClose={() => setLobbyOpen(false)}
      />
    </div>
  );
}

function claimableOf(snapshot: HotelSnapshot): bigint {
  const stay = snapshot.stay;
  if (stay.kind === "checked_in" || stay.kind === "lobby" || stay.kind === "not_checked_in") {
    return stay.claimableWei;
  }
  return 0n;
}
