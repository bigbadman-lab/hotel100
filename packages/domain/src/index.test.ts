import { describe, expect, it } from "vitest";
import { addressLessThan, compareAddressNumeric, normalizeAddress } from "./address.js";
import {
  checkInMinimum,
  countsTowardCheckedInMetric,
  currentRewardMultiplierBps,
  effectiveHotelBalance,
  escrowCoherentWithRoomServiceBalance,
  holdersWithEffectiveEscrowBalance,
  rewardWeight,
  stayBoostPhase,
} from "./check-in.js";
import {
  CHECK_IN_AUTH_VALIDITY_SECONDS,
  CHECK_IN_DURATION_SECONDS,
  COLLECTION_CONFIRMATIONS,
  FINANCIAL_CONFIRMATIONS,
  HOTEL_CHAIN_ID,
  HOTEL_ROOM_COUNT,
  LIVE_CONFIRMATIONS,
  PUBLIC_STALE_THRESHOLD_MS,
  ROOM_SERVICE_INTERVAL_SECONDS,
  SERVICE_CATCHUP_MAX,
} from "./constants.js";
import {
  claimPayoutWei,
  floorDiv,
  proRataAllocationWei,
  totalReceivedWei,
  unallocatedWei,
} from "./financial.js";
import {
  compareHoldersForRanking,
  isLobbyRank,
  isTopHundredRank,
  rankEligibleHolders,
  roomAssignmentForRank,
} from "./ranking.js";
import { requiredBalanceToBeat } from "./required-balance.js";
import {
  firstServiceBoundaryAfterOpen,
  firstServiceNumberAfterOpen,
  isExactServiceBoundary,
  nextServiceBoundaryStrictlyAfter,
  serviceNumberAtBoundary,
} from "./service-time.js";
import {
  initialPostLiveCanaryStatus,
  isPublicStateStale,
  LIVE_CANARY_STATUS,
  PUBLIC_STATUS,
} from "./status.js";

describe("frozen constants", () => {
  it("exposes frozen room count, chain id, and service interval", () => {
    expect(HOTEL_ROOM_COUNT).toBe(100);
    expect(HOTEL_CHAIN_ID).toBe(4663);
    expect(ROOM_SERVICE_INTERVAL_SECONDS).toBe(900);
  });

  it("exposes confirmation and stale policies", () => {
    expect(LIVE_CONFIRMATIONS).toBe(1);
    expect(FINANCIAL_CONFIRMATIONS).toBe(2);
    expect(COLLECTION_CONFIRMATIONS).toBe(1);
    expect(PUBLIC_STALE_THRESHOLD_MS).toBe(30_000);
    expect(SERVICE_CATCHUP_MAX).toBe(8);
  });

  it("exposes frozen check-in duration and auth validity", () => {
    expect(CHECK_IN_DURATION_SECONDS).toBe(3_600);
    expect(CHECK_IN_AUTH_VALIDITY_SECONDS).toBe(120);
  });
});

describe("check-in effective balance and reward weight", () => {
  it("effective balance is wallet + unwithdrawn escrow", () => {
    expect(effectiveHotelBalance(100n, 0n)).toBe(100n);
    expect(effectiveHotelBalance(80n, 20n)).toBe(100n);
    expect(effectiveHotelBalance(0n, 50n)).toBe(50n);
  });

  it("ranking is unaffected by check-in vs wallet split at same total", () => {
    const liquid = rankEligibleHolders([
      { address: "0x0000000000000000000000000000000000000001", balanceRaw: 100n },
      { address: "0x0000000000000000000000000000000000000002", balanceRaw: 90n },
    ]);
    const checkedIn = rankEligibleHolders([
      {
        address: "0x0000000000000000000000000000000000000001",
        balanceRaw: effectiveHotelBalance(70n, 30n),
      },
      { address: "0x0000000000000000000000000000000000000002", balanceRaw: 90n },
    ]);
    expect(liquid.map((h) => h.address)).toEqual(checkedIn.map((h) => h.address));
    expect(liquid[0]?.rank).toBe(1);
  });

  it("minimum check-in is 10% of effective balance with ceiling", () => {
    expect(checkInMinimum(0n)).toBe(0n);
    expect(checkInMinimum(100n)).toBe(10n);
    expect(checkInMinimum(1n)).toBe(1n);
    expect(checkInMinimum(15n)).toBe(2n);
  });

  it("reward weight is 1.5x only while escrow is active and Top 100", () => {
    expect(
      rewardWeight({
        walletHeld: 70n,
        escrowAmount: 30n,
        isActiveEscrow: true,
        isTop100: true,
      }),
    ).toBe(70n + 45n);
    expect(
      rewardWeight({
        walletHeld: 70n,
        escrowAmount: 30n,
        isActiveEscrow: false,
        isTop100: true,
      }),
    ).toBe(100n);
    expect(
      rewardWeight({
        walletHeld: 70n,
        escrowAmount: 30n,
        isActiveEscrow: true,
        isTop100: false,
      }),
    ).toBe(0n);
  });

  it("partial escrow boosts only the escrowed amount", () => {
    expect(
      rewardWeight({
        walletHeld: 90n,
        escrowAmount: 10n,
        isActiveEscrow: true,
        isTop100: true,
      }),
    ).toBe(90n + 15n);
  });

  it("stayBoostPhase uses unlock boundary without floating point", () => {
    expect(
      stayBoostPhase({
        hasUnwithdrawnStay: true,
        unlockTimestamp: 1000,
        snapshotTimestamp: 999,
      }),
    ).toBe("active");
    expect(
      stayBoostPhase({
        hasUnwithdrawnStay: true,
        unlockTimestamp: 1000,
        snapshotTimestamp: 1000,
      }),
    ).toBe("expired");
    expect(
      stayBoostPhase({
        hasUnwithdrawnStay: false,
        unlockTimestamp: 1000,
        snapshotTimestamp: 500,
      }),
    ).toBe("none");
  });

  it("display multiplier and checked-in metric follow Top 100 + phase", () => {
    expect(currentRewardMultiplierBps({ isTop100: true, stayPhase: "active" })).toBe(15_000n);
    expect(currentRewardMultiplierBps({ isTop100: true, stayPhase: "expired" })).toBe(10_000n);
    expect(currentRewardMultiplierBps({ isTop100: false, stayPhase: "active" })).toBe(0n);
    expect(countsTowardCheckedInMetric({ isTop100: true, stayPhase: "active" })).toBe(true);
    expect(countsTowardCheckedInMetric({ isTop100: false, stayPhase: "active" })).toBe(false);
    expect(countsTowardCheckedInMetric({ isTop100: true, stayPhase: "expired" })).toBe(false);
  });

  it("merges escrow into ranking and excludes RoomService without attributing direct transfers", () => {
    const roomService = "0x00000000000000000000000000000000000000c0";
    const guest = "0x0000000000000000000000000000000000000001";
    const other = "0x0000000000000000000000000000000000000002";
    const merged = holdersWithEffectiveEscrowBalance({
      walletHolders: [
        { address: guest, balanceRaw: 60n },
        { address: roomService, balanceRaw: 55n },
        { address: other, balanceRaw: 90n },
      ],
      escrows: [
        {
          guestAddress: guest,
          amountRaw: 40n,
          checkInTimestamp: 1,
          unlockTimestamp: 3601,
        },
      ],
      excludedAddresses: new Set([roomService]),
    });
    const ranked = rankEligibleHolders(merged);
    expect(ranked.map((h) => h.address)).toEqual([guest, other]);
    expect(ranked[0]?.balanceRaw).toBe(100n);
    // Direct surplus on RoomService (55 - 40) is never attributed to a guest.
    expect(
      escrowCoherentWithRoomServiceBalance({
        unwithdrawnEscrowTotal: 40n,
        roomServiceBalanceRaw: 55n,
      }),
    ).toBe(true);
    expect(
      escrowCoherentWithRoomServiceBalance({
        unwithdrawnEscrowTotal: 56n,
        roomServiceBalanceRaw: 55n,
      }),
    ).toBe(false);
  });
});

describe("address normalization and numeric comparison", () => {
  it("lowercases checksum addresses", () => {
    expect(normalizeAddress("0xAbCdEf0123456789AbCdEf0123456789aBcDeF01")).toBe(
      "0xabcdef0123456789abcdef0123456789abcdef01",
    );
  });

  it("rejects invalid shapes", () => {
    expect(() => normalizeAddress("not-an-address")).toThrow(/Invalid address/);
    expect(() => normalizeAddress("0x123")).toThrow(/Invalid address/);
  });

  it("compares numerically, not lexicographically by checksum", () => {
    // Lower numeric: ...0001 < ...0002
    const low = "0x0000000000000000000000000000000000000001";
    const high = "0x0000000000000000000000000000000000000002";
    expect(compareAddressNumeric(low, high)).toBe(-1);
    expect(addressLessThan(low, high)).toBe(true);
    expect(addressLessThan(high, low)).toBe(false);
    expect(compareAddressNumeric(low, low)).toBe(0);
  });

  it("treats mixed-case forms of the same address as equal", () => {
    const a = "0x00000000000000000000000000000000000000Aa";
    const b = "0x00000000000000000000000000000000000000aa";
    expect(compareAddressNumeric(a, b)).toBe(0);
  });
});

describe("required balance / move-up math", () => {
  const target = "0x0000000000000000000000000000000000000010";
  const lowerUser = "0x0000000000000000000000000000000000000005";
  const higherUser = "0x0000000000000000000000000000000000000020";
  const targetBalance = 1_000n;

  it("user address lower than target → requiredBalance = targetBalance", () => {
    const r = requiredBalanceToBeat({
      userAddress: lowerUser,
      userBalance: 0n,
      targetAddress: target,
      targetBalance,
    });
    expect(r.requiredBalance).toBe(1_000n);
    expect(r.additionalNeeded).toBe(1_000n);
  });

  it("user address higher than target → requiredBalance = targetBalance + 1", () => {
    const r = requiredBalanceToBeat({
      userAddress: higherUser,
      userBalance: 0n,
      targetAddress: target,
      targetBalance,
    });
    expect(r.requiredBalance).toBe(1_001n);
    expect(r.additionalNeeded).toBe(1_001n);
  });

  it("exact tie on address uses +1 raw unit vs same address target", () => {
    const r = requiredBalanceToBeat({
      userAddress: target,
      userBalance: targetBalance,
      targetAddress: target,
      targetBalance,
    });
    expect(r.requiredBalance).toBe(targetBalance + 1n);
    expect(r.additionalNeeded).toBe(1n);
  });

  it("zero additional needed when already strictly ahead for lower address", () => {
    const r = requiredBalanceToBeat({
      userAddress: lowerUser,
      userBalance: targetBalance,
      targetAddress: target,
      targetBalance,
    });
    expect(r.additionalNeeded).toBe(0n);
  });

  it("+1 raw-unit requirement when higher address holds exact target balance", () => {
    const r = requiredBalanceToBeat({
      userAddress: higherUser,
      userBalance: targetBalance,
      targetAddress: target,
      targetBalance,
    });
    expect(r.requiredBalance).toBe(targetBalance + 1n);
    expect(r.additionalNeeded).toBe(1n);
  });

  it("room #100 threshold uses same beat math against rank-100 holder", () => {
    const rank100 = "0x0000000000000000000000000000000000000064";
    const lobbyUser = "0x00000000000000000000000000000000000000ff";
    const r = requiredBalanceToBeat({
      userAddress: lobbyUser,
      userBalance: 50n,
      targetAddress: rank100,
      targetBalance: 100n,
    });
    // lobbyUser > rank100 ⇒ need 101
    expect(r.requiredBalance).toBe(101n);
    expect(r.additionalNeeded).toBe(51n);
  });
});

describe("holder ranking and tie-break", () => {
  it("sorts by balance DESC then numeric address ASC", () => {
    const ranked = rankEligibleHolders([
      { address: "0x0000000000000000000000000000000000000002", balanceRaw: 100n },
      { address: "0x0000000000000000000000000000000000000001", balanceRaw: 100n },
      { address: "0x0000000000000000000000000000000000000003", balanceRaw: 200n },
    ]);
    expect(ranked.map((h) => h.address)).toEqual([
      "0x0000000000000000000000000000000000000003",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
    ]);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(2);
  });

  it("lower numeric address wins equal-balance ties", () => {
    const a = {
      address: "0x00000000000000000000000000000000000000aa" as const,
      balanceRaw: 5n,
    };
    const b = {
      address: "0x00000000000000000000000000000000000000bb" as const,
      balanceRaw: 5n,
    };
    expect(compareHoldersForRanking(a, b)).toBeLessThan(0);
  });

  it("maps ranks to penthouse, rooms, and lobby", () => {
    expect(roomAssignmentForRank(1)).toEqual({
      kind: "penthouse",
      room: 1,
      rank: 1,
    });
    expect(roomAssignmentForRank(2)).toEqual({ kind: "room", room: 2, rank: 2 });
    expect(roomAssignmentForRank(100)).toEqual({
      kind: "room",
      room: 100,
      rank: 100,
    });
    expect(roomAssignmentForRank(101)).toEqual({ kind: "lobby", rank: 101 });
    expect(isTopHundredRank(100)).toBe(true);
    expect(isTopHundredRank(101)).toBe(false);
    expect(isLobbyRank(101)).toBe(true);
  });
});

describe("Service boundary math", () => {
  it("uses 900-second service numbers", () => {
    expect(serviceNumberAtBoundary(0)).toBe(0);
    expect(serviceNumberAtBoundary(900)).toBe(1);
    expect(serviceNumberAtBoundary(1800)).toBe(2);
  });

  it("first Service is strictly after open when open is exact boundary", () => {
    const open = 1_700_000_000; // choose a known second
    // Force exact boundary
    const exact = Math.floor(open / 900) * 900;
    expect(isExactServiceBoundary(exact)).toBe(true);
    const first = firstServiceBoundaryAfterOpen(exact);
    expect(first).toBe(exact + 900);
    expect(first).toBeGreaterThan(exact);
    expect(firstServiceNumberAfterOpen(exact)).toBe(exact / 900 + 1);
  });

  it("first Service is next boundary when open is just before a boundary", () => {
    const boundary = 1_700_000_100 - (1_700_000_100 % 900);
    const open = boundary - 1;
    expect(nextServiceBoundaryStrictlyAfter(open)).toBe(boundary);
    expect(firstServiceBoundaryAfterOpen(open)).toBe(boundary);
  });

  it("first Service skips current partial window when open is just after a boundary", () => {
    const boundary = 1_700_000_100 - (1_700_000_100 % 900);
    const open = boundary + 1;
    expect(firstServiceBoundaryAfterOpen(open)).toBe(boundary + 900);
  });
});

describe("integer financial primitives", () => {
  it("floorDiv and pro-rata use integer floor only", () => {
    expect(floorDiv(10n, 3n)).toBe(3n);
    expect(proRataAllocationWei(100n, 1n, 3n)).toBe(33n);
    expect(
      proRataAllocationWei(100n, 1n, 3n) +
        proRataAllocationWei(100n, 1n, 3n) +
        proRataAllocationWei(100n, 1n, 3n),
    ).toBe(99n);
  });

  it("totalReceived and unallocated follow claim-invariant formula", () => {
    const received = totalReceivedWei(40n, 60n);
    expect(received).toBe(100n);
    expect(unallocatedWei(received, 75n)).toBe(25n);
  });

  it("claim payout is cumulative delta", () => {
    expect(claimPayoutWei(100n, 40n)).toBe(60n);
    expect(() => claimPayoutWei(10n, 20n)).toThrow();
  });
});

describe("status enums", () => {
  it("exposes frozen public and canary strings", () => {
    expect(PUBLIC_STATUS.CHECK_IN_OPENS_SOON).toBe("HOTEL CHECK-IN OPENS SOON");
    expect(PUBLIC_STATUS.SYNCING).toBe("HOTEL SYNCING");
    expect(PUBLIC_STATUS.ROOM_SERVICE_DELAYED).toBe("ROOM SERVICE DELAYED");
    expect(PUBLIC_STATUS.ROOM_SERVICE_ARRIVING).toBe("ROOM SERVICE ARRIVING");
    expect(PUBLIC_STATUS.NOT_CHECKED_IN).toBe("NOT CHECKED IN");
    expect(initialPostLiveCanaryStatus()).toBe(LIVE_CANARY_STATUS.CANARY_PENDING);
    expect(LIVE_CANARY_STATUS.MVP_LIVE).toBe("PASS — MVP LIVE");
  });

  it("marks public state stale after 30 seconds", () => {
    expect(isPublicStateStale(1_000, 31_001, PUBLIC_STALE_THRESHOLD_MS)).toBe(true);
    expect(isPublicStateStale(1_000, 31_000, PUBLIC_STALE_THRESHOLD_MS)).toBe(false);
  });
});
