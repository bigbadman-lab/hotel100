import { rewardWeight } from "@hotel100/domain";
import { describe, expect, it } from "vitest";
import { allocateServicePool, type SnapshotGuest } from "../room-service/allocate.js";

const ALICE = "0x0000000000000000000000000000000000000001" as const;
const BOB = "0x0000000000000000000000000000000000000002" as const;

describe("allocateServicePool reward weighting", () => {
  it("pro-rata uses rewardWeightRaw when provided (1.5x active escrow)", () => {
    const aliceWeight = rewardWeight({
      walletHeld: 50n,
      escrowAmount: 50n,
      isActiveEscrow: true,
      isTop100: true,
    });
    expect(aliceWeight).toBe(125n);
    const bobWeight = rewardWeight({
      walletHeld: 100n,
      escrowAmount: 0n,
      isActiveEscrow: false,
      isTop100: true,
    });
    expect(bobWeight).toBe(100n);

    const guests: SnapshotGuest[] = [
      { address: ALICE, balanceRaw: aliceWeight, rewardWeightRaw: aliceWeight, rank: 1 },
      { address: BOB, balanceRaw: bobWeight, rewardWeightRaw: bobWeight, rank: 2 },
    ];
    const result = allocateServicePool({ servicePoolWei: 225n, guests });
    expect(result.allocations.map((a) => a.allocationWei)).toEqual([125n, 100n]);
    expect(result.dustWei).toBe(0n);
  });

  it("falls back to balanceRaw when rewardWeightRaw omitted", () => {
    const result = allocateServicePool({
      servicePoolWei: 10n,
      guests: [
        { address: ALICE, balanceRaw: 1n, rank: 1 },
        { address: BOB, balanceRaw: 1n, rank: 2 },
      ],
    });
    expect(result.allocations.map((a) => a.allocationWei)).toEqual([5n, 5n]);
  });
});
