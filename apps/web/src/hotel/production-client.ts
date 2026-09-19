import type { Address } from "@hotel100/domain";
import { emptyRooms } from "./present";
import { type PublicHotelStateDto, snapshotFromPublicDto } from "./public-dto";
import type { HotelSnapshot } from "./types";

/**
 * Used when the public API cannot be read.
 * Hotel is treated as not current, so the header is HOTEL SYNCING.
 * Fixture holders are never substituted.
 */
export function failClosedProductionSnapshot(): HotelSnapshot {
  return {
    source: "production",
    fixturePreview: false,
    hotelLive: true,
    canaryPending: true,
    lastIndexedAtMs: null,
    roomServiceDelayed: false,
    connectedWallet: null,
    rooms: emptyRooms(),
    lobby: [],
    stay: { kind: "disconnected" },
    activity: [],
    market: {
      tokenLabel: "$HOTEL",
      price: null,
      marketCap: null,
      liquidity: null,
      holders: null,
      contract: null,
    },
    activeCheckedInTop100Count: 0,
    checkInEnabled: false,
  };
}

export async function fetchProductionSnapshot(
  wallet: Address | null,
  fetchImpl: typeof fetch = fetch,
): Promise<HotelSnapshot> {
  const query = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  try {
    const response = await fetchImpl(`/api/hotel/state${query}`, { cache: "no-store" });
    if (!response.ok) return failClosedProductionSnapshot();
    const dto = (await response.json()) as PublicHotelStateDto;
    return snapshotFromPublicDto(dto);
  } catch {
    return failClosedProductionSnapshot();
  }
}
