import type {
  BusApplicableRoute,
  BusApplicableTrip,
  BusComputedStopTime,
} from "@/features/bus/lib/bus-client";

export {
  type BusPreferenceSaveState,
  busPreferenceStatusText,
  saveBusPlannerPreference,
} from "./bus-preferences";

type BusDataWithTrips = {
  trips: Array<{
    dayType: string;
    stopTimes: Array<{ time: string | null }>;
  }>;
};

export function busStopTimeLabel(stopTime: BusComputedStopTime) {
  if (!stopTime.displayTime) return "—";
  return stopTime.isEstimated
    ? `~${stopTime.displayTime}`
    : stopTime.displayTime;
}

function busRouteSegmentStopRange(route: BusApplicableRoute) {
  const stops = route.route.stops;
  const startIndex = stops.findIndex(
    (stop) => stop.stopOrder === route.startStop.stopOrder,
  );
  const endIndex = stops.findIndex(
    (stop) => stop.stopOrder === route.endStop.stopOrder,
  );

  return { endIndex, startIndex };
}

export function busRouteSegmentStopColumns(route: BusApplicableRoute) {
  const stops = route.route.stops;
  const { endIndex, startIndex } = busRouteSegmentStopRange(route);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return [];

  return stops.slice(startIndex, endIndex + 1).map((stop) => ({
    label: stop.campus.namePrimary,
    stopOrder: stop.stopOrder,
  }));
}

export function busTripStopTimeForOrder(
  trip: BusApplicableTrip,
  stopOrder: number,
) {
  return (
    trip.stopTimes.find((stopTime) => stopTime.stopOrder === stopOrder) ??
    trip.startTime
  );
}

export function nextBusTripHighlightKey(routes: BusApplicableRoute[]) {
  let bestKey: string | null = null;
  let bestMinutes = Number.POSITIVE_INFINITY;

  for (const route of routes) {
    for (const trip of route.visibleTrips) {
      if (trip.status !== "upcoming") continue;
      const minutes = trip.startTime.displayMinutes;
      if (minutes == null || minutes >= bestMinutes) continue;
      bestMinutes = minutes;
      bestKey = `${route.route.id}:${trip.trip.id}`;
    }
  }

  return bestKey;
}

export function hasEstimatedBusTimes(
  data: BusDataWithTrips | null,
  routes: BusApplicableRoute[],
  dayType: string,
) {
  if (
    routes.some((route) => {
      const segmentStopOrders = new Set(
        busRouteSegmentStopColumns(route).map((stop) => stop.stopOrder),
      );
      return route.visibleTrips.some((trip) =>
        trip.stopTimes.some(
          (stopTime) =>
            segmentStopOrders.has(stopTime.stopOrder) && stopTime.isEstimated,
        ),
      );
    })
  ) {
    return true;
  }

  return Boolean(
    data?.trips.some(
      (trip) =>
        trip.dayType === dayType &&
        trip.stopTimes.some((stopTime) => stopTime.time == null),
    ),
  );
}
