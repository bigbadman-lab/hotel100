import { PUBLIC_STATUS, ROOM_POLL_INTERVAL_MS } from "@hotel100/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { prepareRoomServiceClaim } from "./hotel/claim";
import { HotelFacade } from "./hotel/components/HotelView";
import { FACADE_COLUMNS, FACADE_ROWS, standardRoomNumbers } from "./hotel/format";
import { diffHotelMotion } from "./hotel/motion";
import {
  isRoomServiceArriving,
  presentHeaderStatus,
  secondsUntilNextService,
} from "./hotel/present";
import {
  FIXTURE_MOVE_UP_RAW,
  fixtureSnapshot,
  loadHotelSnapshot,
  resolveHotelMode,
} from "./hotel/source";

describe("Gate H public hotel UI", () => {
  it("keeps 99 façade rooms in fixed 11 by 9 order under a separate penthouse", () => {
    expect(FACADE_COLUMNS * FACADE_ROWS).toBe(99);
    const numbers = standardRoomNumbers();
    expect(numbers[0]).toBe(2);
    expect(numbers.at(-1)).toBe(100);
    expect(numbers).toHaveLength(99);
    const html = renderToStaticMarkup(
      <HotelFacade
        snapshot={fixtureSnapshot("checked_in")}
        selectedRoom={47}
        youRoom={47}
        stale={false}
        arriving={false}
        lightRooms={[]}
        penthouseMotion={false}
        entranceMotion={false}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("PENTHOUSE");
    expect(html.match(/data-room="/g)?.length).toBe(99);
    expect(html.indexOf('data-room="2"')).toBeLessThan(html.indexOf('data-room="12"'));
    expect(html.indexOf('data-room="12"')).toBeLessThan(html.indexOf('data-room="100"'));
    expect(html).toContain('id="room-47"');
    expect(html).toContain("you");
    expect(html).toContain(">VAC<");
    expect(html).not.toContain("0x0000000000000000000000000000000000000a31");
  });

  it("uses canonical movement math for the checked-in guest and lobby door", () => {
    const checked = fixtureSnapshot("checked_in");
    expect(checked.stay.kind).toBe("checked_in");
    if (checked.stay.kind === "checked_in") {
      expect(checked.stay.additionalNeededRaw).toBe(FIXTURE_MOVE_UP_RAW);
      expect(checked.stay.targetRoom).toBe(46);
    }
    const lobby = fixtureSnapshot("lobby");
    expect(lobby.stay.kind).toBe("lobby");
    if (lobby.stay.kind === "lobby") {
      expect(lobby.stay.additionalNeededRaw).not.toBeNull();
      expect(lobby.stay.rank).toBe(104);
    }
    const former = fixtureSnapshot("former");
    expect(former.stay.kind).toBe("not_checked_in");
  });

  it("shows HOTEL SYNCING when indexed data is stale and keeps production off fixtures", () => {
    expect(
      presentHeaderStatus({
        hotelLive: true,
        fixturePreview: false,
        canaryPending: true,
        lastIndexedAtMs: 1_000,
        nowMs: 1_000 + 30_001,
        roomServiceDelayed: false,
        arriving: false,
      }).label,
    ).toBe(PUBLIC_STATUS.SYNCING);
    expect(
      presentHeaderStatus({
        hotelLive: false,
        fixturePreview: false,
        canaryPending: true,
        lastIndexedAtMs: null,
        nowMs: 0,
        roomServiceDelayed: false,
        arriving: false,
      }).label,
    ).toBe(PUBLIC_STATUS.CHECK_IN_OPENS_SOON);
    expect(
      resolveHotelMode({ hotelLive: true, allowFixturePreview: true, preview: "fixture" }),
    ).toBe("production");
    expect(
      resolveHotelMode({ hotelLive: false, allowFixturePreview: false, preview: "fixture" }),
    ).toBe("production");
    const production = loadHotelSnapshot({ mode: "production", hotelLive: false });
    expect(production.rooms.every((room) => room.occupant === null)).toBe(true);
    expect(production.market.price).toBeNull();
    expect(ROOM_POLL_INTERVAL_MS).toBe(2_000);
  });

  it("marks the exact service boundary as arriving and does not replay a wide rank diff", () => {
    expect(isRoomServiceArriving(1_800, false)).toBe(true);
    expect(secondsUntilNextService(1_800)).toBe(0);
    expect(isRoomServiceArriving(1_801, false)).toBe(false);
    expect(isRoomServiceArriving(1_800, true)).toBe(false);

    const before = fixtureSnapshot("checked_in");
    const after = fixtureSnapshot("checked_in");
    after.rooms = after.rooms.map((slot) =>
      slot.occupant
        ? { ...slot, occupant: { ...slot.occupant, address: `0x${"ab".repeat(20)}` as never } }
        : slot,
    );
    expect(diffHotelMotion(before, after)).toEqual([]);

    const one = fixtureSnapshot("checked_in");
    const moved = fixtureSnapshot("checked_in");
    const room12 = moved.rooms.find((slot) => slot.room === 12);
    if (room12?.occupant)
      room12.occupant = { ...room12.occupant, address: `0x${"cd".repeat(20)}` as never };
    expect(
      diffHotelMotion(one, moved).some((cue) => cue.kind === "occupant-light" && cue.room === 12),
    ).toBe(true);
  });

  it("prepares a Room Service claim without broadcasting", async () => {
    const calls: string[] = [];
    const result = await prepareRoomServiceClaim({
      origin: "http://127.0.0.1",
      wallet: "0x0000000000000000000000000000000000000a31",
      signMessage: async () => `0x${"11".repeat(65)}`,
      fetchImpl: async (input, init) => {
        calls.push(String(input));
        const url = String(input);
        if (url.endsWith("/challenge")) {
          return new Response(JSON.stringify({ message: "sign-me" }), { status: 200 });
        }
        expect(init?.body).toContain("sign-me");
        return new Response(
          JSON.stringify({
            guest: "0x0000000000000000000000000000000000000a31",
            signature: `0x${"22".repeat(65)}`,
            deadline: "100",
            signerEpoch: "1",
            cumulativeFinalizedEarnedWei: "10",
          }),
          { status: 200 },
        );
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claim.functionName).toBe("claimRoomService");
      expect(result.claim.args[0]).toBe(10n);
      expect("broadcast" in result.claim).toBe(false);
    }
    expect(calls).toEqual([
      "http://127.0.0.1/api/entitlement/challenge",
      "http://127.0.0.1/api/entitlement",
    ]);
  });
});
