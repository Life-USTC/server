import { parseBusTimeMinutes } from "./bus-time";
import type { BusMapActiveTrip } from "./bus-types";

type BusMapTripRecord = {
  dayType: "weekday" | "weekend";
  id: number;
  routeId: number;
  stopTimes: unknown;
};

function normalizeStopTimes(value: unknown): Array<string | null> {
  return Array.isArray(value)
    ? value.map((time) => (typeof time === "string" ? time : null))
    : [];
}

export function buildBusMapActiveTrips({
  nowMinutes,
  todayType,
  trips,
}: {
  nowMinutes: number;
  todayType: "weekday" | "weekend";
  trips: BusMapTripRecord[];
}): BusMapActiveTrip[] {
  const activeTrips: BusMapActiveTrip[] = [];

  for (const trip of trips.filter((item) => item.dayType === todayType)) {
    const stopTimes = normalizeStopTimes(trip.stopTimes);
    const parsedTimes = stopTimes.map((time) => parseBusTimeMinutes(time));
    const firstTime = parsedTimes.find((time) => time != null);
    const lastTime = [...parsedTimes].reverse().find((time) => time != null);
    if (firstTime == null || lastTime == null) continue;

    if (nowMinutes >= firstTime && nowMinutes <= lastTime) {
      activeTrips.push(
        buildEnRouteBusMapTrip({ nowMinutes, parsedTimes, stopTimes, trip }),
      );
    } else if (firstTime > nowMinutes && firstTime <= nowMinutes + 60) {
      activeTrips.push({
        tripId: trip.id,
        routeId: trip.routeId,
        status: "departing-soon",
        departureTime: stopTimes[0] ?? null,
        arrivalTime: stopTimes[stopTimes.length - 1] ?? null,
        fromStopOrder: null,
        toStopOrder: null,
        segmentProgress: null,
      });
    }
  }

  return activeTrips;
}

function buildEnRouteBusMapTrip({
  nowMinutes,
  parsedTimes,
  stopTimes,
  trip,
}: {
  nowMinutes: number;
  parsedTimes: Array<number | null>;
  stopTimes: Array<string | null>;
  trip: BusMapTripRecord;
}): BusMapActiveTrip {
  let fromOrder: number | null = null;
  let toOrder: number | null = null;
  let progress: number | null = null;
  for (let index = 0; index < parsedTimes.length - 1; index += 1) {
    const start = parsedTimes[index];
    const end = parsedTimes[index + 1];
    if (
      start != null &&
      end != null &&
      nowMinutes >= start &&
      nowMinutes <= end
    ) {
      fromOrder = index;
      toOrder = index + 1;
      progress = end > start ? (nowMinutes - start) / (end - start) : 0;
      break;
    }
  }

  return {
    tripId: trip.id,
    routeId: trip.routeId,
    status: "en-route",
    departureTime: stopTimes[0] ?? null,
    arrivalTime: stopTimes[stopTimes.length - 1] ?? null,
    fromStopOrder: fromOrder,
    toStopOrder: toOrder,
    segmentProgress: progress != null ? Math.round(progress * 100) / 100 : null,
  };
}
