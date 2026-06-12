import type { BusTripSlot } from "./bus-types";

export function formatMinutesAsTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function busTripsToSlots(
  trips: Array<{ position: number; stopTimes: unknown }>,
): BusTripSlot[] {
  return trips.map((trip) => ({
    position: trip.position,
    stopTimes: (trip.stopTimes as Array<string | null>).map((time, index) => ({
      stopOrder: index,
      time,
    })),
  }));
}
