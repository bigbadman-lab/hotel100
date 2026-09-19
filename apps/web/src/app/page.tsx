import { hotelConfigFromEnv } from "@hotel100/config";
import { HotelApp } from "@/hotel/HotelApp";
import { resolveHotelMode } from "@/hotel/source";
import type { FixtureScenario } from "@/hotel/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; stay?: string }>;
}) {
  const params = await searchParams;
  const hotelLive = process.env.HOTEL_LIVE === "true" || process.env.HOTEL_LIVE === "1";
  const allowFixturePreview = process.env.NODE_ENV !== "production";
  const mode = resolveHotelMode({
    hotelLive,
    allowFixturePreview,
    preview: params.preview,
  });
  const scenario = parseScenario(params.stay);
  const roomServiceAddress = hotelConfigFromEnv(process.env).roomServiceAddress ?? null;
  const hotelTokenAddress = hotelConfigFromEnv(process.env).tokenAddress ?? null;
  return (
    <HotelApp
      mode={mode}
      hotelLive={hotelLive}
      scenario={scenario}
      roomServiceAddress={roomServiceAddress}
      hotelTokenAddress={hotelTokenAddress}
    />
  );
}

function parseScenario(value: string | undefined): FixtureScenario {
  if (value === "lobby" || value === "former") return value;
  return "checked_in";
}
