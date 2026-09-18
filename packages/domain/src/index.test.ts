import { describe, expect, it } from "vitest";
import { HOTEL_CHAIN_ID, HOTEL_ROOM_COUNT } from "./index.js";

describe("@hotel100/domain bootstrap", () => {
  it("exposes frozen room count and chain id constants", () => {
    expect(HOTEL_ROOM_COUNT).toBe(100);
    expect(HOTEL_CHAIN_ID).toBe(4663);
  });
});
