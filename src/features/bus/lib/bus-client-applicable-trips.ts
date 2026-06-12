import { buildComputedStopTime } from "./bus-client-stop-times";
import type { BusApplicableRoute, BusApplicableTrip } from "./bus-client-types";
import type { BusTripSummary } from "./bus-types";

export function buildApplicableBusTrips({
  dayType,
  endIndex,
  endStop,
  nowMinutes,
  route,
  startIndex,
  startStop,
  trips,
}: {
  dayType: "weekday" | "weekend";
  endIndex: number;
  endStop: BusApplicableRoute["endStop"];
  nowMinutes: number;
  route: BusApplicableRoute["route"];
  startIndex: number;
  startStop: BusApplicableRoute["startStop"];
  trips: BusTripSummary[];
}): BusApplicableTrip[] {
  return trips
    .filter((trip) => trip.routeId === route.id && trip.dayType === dayType)
    .map<BusApplicableTrip>((trip) => {
      const stopTimes = trip.stopTimes.map((_: unknown, index: number) =>
        buildComputedStopTime(trip.stopTimes, index),
      );
      const startTime = stopTimes[startIndex];
      const endTime = stopTimes[endIndex];
      const status =
        startTime.displayMinutes == null ||
        startTime.displayMinutes >= nowMinutes
          ? "upcoming"
          : "departed";

      return {
        trip,
        route,
        stopTimes,
        startStop,
        endStop,
        startTime,
        endTime,
        status,
        minutesUntilStart:
          startTime.displayMinutes == null
            ? null
            : startTime.displayMinutes - nowMinutes,
      };
    })
    .sort((left, right) => {
      const leftMinutes =
        left.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
      const rightMinutes =
        right.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;

      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }

      return left.trip.position - right.trip.position;
    });
}
