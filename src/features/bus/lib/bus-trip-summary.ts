import { parseBusTimeMinutes } from "./bus-time";
import type {
  BusRouteSummary,
  BusTripStopTime,
  BusTripSummary,
} from "./bus-types";

export function buildTripSummary(
  trip: {
    id: number;
    routeId: number;
    dayType: "weekday" | "weekend";
    position: number;
    stopTimes: unknown;
  },
  route: BusRouteSummary,
): BusTripSummary {
  const rawTimes = Array.isArray(trip.stopTimes)
    ? (trip.stopTimes as Array<string | null>)
    : [];

  const stopTimes = route.stops.map<BusTripStopTime>((stop, index) => {
    const time = rawTimes[index] ?? null;
    return {
      stopOrder: stop.stopOrder,
      campusId: stop.campus.id,
      campusName: stop.campus.namePrimary,
      time,
      minutesSinceMidnight: parseBusTimeMinutes(time),
      isPassThrough: time == null,
    };
  });

  const departureTime = stopTimes[0]?.time ?? null;
  const departureMinutes = stopTimes[0]?.minutesSinceMidnight ?? null;
  const arrivalTime = stopTimes[stopTimes.length - 1]?.time ?? null;
  const arrivalMinutes =
    stopTimes[stopTimes.length - 1]?.minutesSinceMidnight ?? null;

  return {
    id: trip.id,
    routeId: route.id,
    dayType: trip.dayType,
    position: trip.position,
    stopTimes,
    departureTime,
    departureMinutes,
    arrivalTime,
    arrivalMinutes,
  };
}
