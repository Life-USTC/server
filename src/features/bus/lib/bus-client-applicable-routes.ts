import { buildApplicableBusTrips } from "./bus-client-applicable-trips";
import { getShanghaiMinutesSinceMidnight } from "./bus-client-time";
import type { BusApplicableRoute } from "./bus-client-types";
import type { BusTimetableData } from "./bus-types";

type BusApplicableRoutesData = Pick<BusTimetableData, "routes" | "trips">;

export function getApplicableBusRoutes(input: {
  data: BusApplicableRoutesData;
  dayType: "weekday" | "weekend";
  startCampusId: number | null;
  endCampusId: number | null;
  showDepartedTrips: boolean;
  now: Date;
}): BusApplicableRoute[] {
  const { data, dayType, startCampusId, endCampusId, showDepartedTrips, now } =
    input;
  const nowMinutes = getShanghaiMinutesSinceMidnight(now);

  return data.routes
    .flatMap<BusApplicableRoute>((route) => {
      const startStop = route.stops.find(
        (stop) => stop.campus.id === startCampusId,
      );
      const endStop = route.stops.find(
        (stop) => stop.campus.id === endCampusId,
      );

      if (!startStop || !endStop || startStop.stopOrder >= endStop.stopOrder) {
        return [];
      }

      const startIndex = route.stops.findIndex(
        (stop) => stop.stopOrder === startStop.stopOrder,
      );
      const endIndex = route.stops.findIndex(
        (stop) => stop.stopOrder === endStop.stopOrder,
      );

      const allTrips = buildApplicableBusTrips({
        dayType,
        endIndex,
        endStop,
        nowMinutes,
        route,
        startIndex,
        startStop,
        trips: data.trips,
      });

      const upcomingTrips = allTrips.filter(
        (trip) => trip.status === "upcoming",
      );

      return [
        {
          route,
          startStop,
          endStop,
          nextTrip: upcomingTrips[0] ?? null,
          upcomingTrips,
          visibleTrips: showDepartedTrips ? allTrips : upcomingTrips,
          allTrips,
          totalTrips: allTrips.length,
        },
      ];
    })
    .sort((left, right) => {
      const leftMinutes =
        left.nextTrip?.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
      const rightMinutes =
        right.nextTrip?.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;

      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }

      return left.route.id - right.route.id;
    });
}
