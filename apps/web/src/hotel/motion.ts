import { connectedRoom } from "./present";
import type { HotelSnapshot } from "./types";

export type MotionCue =
  | { kind: "occupant-light"; room: number }
  | { kind: "you-moved"; fromRoom: number | null; toRoom: number | null }
  | { kind: "check-in-100" }
  | { kind: "penthouse-takeover" }
  | { kind: "room-service-arriving" };

/**
 * Compare only the latest two confirmed snapshots.
 * A wide diff is treated as a silent correction (reorg / first paint), not a replay.
 */
export function diffHotelMotion(previous: HotelSnapshot | null, next: HotelSnapshot): MotionCue[] {
  if (!previous || previous.source !== next.source) return [];

  const cues: MotionCue[] = [];
  const fromRoom = connectedRoom(previous);
  const toRoom = connectedRoom(next);
  if (fromRoom !== toRoom) {
    cues.push({ kind: "you-moved", fromRoom, toRoom });
    if (toRoom === 100 && fromRoom !== 100) cues.push({ kind: "check-in-100" });
  }

  const changed: number[] = [];
  for (const room of next.rooms) {
    const before =
      previous.rooms.find((slot) => slot.room === room.room)?.occupant?.address ?? null;
    const after = room.occupant?.address ?? null;
    if (before !== after) changed.push(room.room);
  }

  if (changed.length > 0 && changed.length <= 2) {
    for (const room of changed) {
      if (room === toRoom) continue;
      cues.push({ kind: "occupant-light", room });
      if (room === 1) cues.push({ kind: "penthouse-takeover" });
    }
  }

  return cues;
}

export function arrivingCue(wasArriving: boolean, arriving: boolean): MotionCue[] {
  if (!wasArriving && arriving) return [{ kind: "room-service-arriving" }];
  return [];
}
