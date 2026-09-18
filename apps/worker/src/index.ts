/**
 * Single HOTEL worker/indexer service — Gates E/F+.
 * Bootstrap entrypoint only. No production broadcast.
 */
import { HOTEL_LIVE_DEFAULT } from "@hotel100/config";
import { HOTEL_CHAIN_ID, ROOM_SERVICE_INTERVAL_SECONDS } from "@hotel100/domain";

function main(): void {
  console.log("[hotel100/worker] bootstrap scaffold");
  console.log(`chainId=${HOTEL_CHAIN_ID} liveDefault=${HOTEL_LIVE_DEFAULT}`);
  console.log(`roomServiceIntervalSeconds=${ROOM_SERVICE_INTERVAL_SECONDS}`);
  console.log("No indexer loop started. Gate E+ implements worker behavior.");
}

main();
