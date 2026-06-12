import {
  getShanghaiMinutesSinceMidnight,
  resolveApplicableRouteStops,
  sortApplicableRoutes,
  sortApplicableTrips,
} from "./bus-applicable-route-helpers";
import {
  type BusApplicableTrip,
  buildApplicableBusTrip,
} from "./bus-applicable-trip";
import type {
  BusRouteStopSummary,
  BusRouteSummary,
  BusTimetableData,
} from "./bus-types";

export type { BusApplicableTrip } from "./bus-applicable-trip";

export type BusApplicableRoute = {
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  visibleTrips: BusApplicableTrip[];
  upcomingTrips: BusApplicableTrip[];
};

export function buildApplicableBusRoutes(input: {
  data: BusTimetableData;
  dayType: "weekday" | "weekend";
  originCampusId: number;
  destinationCampusId: number;
  showDepartedTrips: boolean;
  now: Date;
}): BusApplicableRoute[] {
  const {
    data,
    dayType,
    originCampusId,
    destinationCampusId,
    showDepartedTrips,
    now,
  } = input;
  const nowMinutes = getShanghaiMinutesSinceMidnight(now);

  return sortApplicableRoutes(
    data.routes.flatMap<BusApplicableRoute>((route) => {
      const stopSelection = resolveApplicableRouteStops({
        destinationCampusId,
        originCampusId,
        route,
      });
      if (!stopSelection) return [];
      const { endIndex, endStop, startIndex, startStop } = stopSelection;

      const allTrips = sortApplicableTrips(
        data.trips
          .filter(
            (trip) => trip.routeId === route.id && trip.dayType === dayType,
          )
          .map<BusApplicableTrip>((trip) => {
            return buildApplicableBusTrip({
              endIndex,
              endStop,
              nowMinutes,
              route,
              startIndex,
              startStop,
              trip,
            });
          }),
      );

      const upcomingTrips = allTrips.filter(
        (trip) => trip.status === "upcoming",
      );

      return [
        {
          route,
          startStop,
          endStop,
          visibleTrips: showDepartedTrips ? allTrips : upcomingTrips,
          upcomingTrips,
        },
      ];
    }),
  );
}
