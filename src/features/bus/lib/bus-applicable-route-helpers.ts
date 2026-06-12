import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type {
  BusApplicableRoute,
  BusApplicableTrip,
} from "./bus-applicable-routes";
import type { BusRouteStopSummary, BusRouteSummary } from "./bus-types";

export function getShanghaiMinutesSinceMidnight(now: Date | string) {
  const shanghaiNow = shanghaiDayjs(now);
  return shanghaiNow.hour() * 60 + shanghaiNow.minute();
}

export function resolveApplicableRouteStops(input: {
  destinationCampusId: number;
  originCampusId: number;
  route: BusRouteSummary;
}): {
  endIndex: number;
  endStop: BusRouteStopSummary;
  startIndex: number;
  startStop: BusRouteStopSummary;
} | null {
  const startStop = input.route.stops.find(
    (stop) => stop.campus.id === input.originCampusId,
  );
  const endStop = input.route.stops.find(
    (stop) => stop.campus.id === input.destinationCampusId,
  );

  if (!startStop || !endStop || startStop.stopOrder >= endStop.stopOrder) {
    return null;
  }

  return {
    endIndex: input.route.stops.findIndex(
      (stop) => stop.stopOrder === endStop.stopOrder,
    ),
    endStop,
    startIndex: input.route.stops.findIndex(
      (stop) => stop.stopOrder === startStop.stopOrder,
    ),
    startStop,
  };
}

export function sortApplicableTrips(trips: BusApplicableTrip[]) {
  return trips.sort((left, right) => {
    const lm = left.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
    const rm = right.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
    return lm !== rm ? lm - rm : left.trip.position - right.trip.position;
  });
}

export function sortApplicableRoutes(routes: BusApplicableRoute[]) {
  return routes.sort((left, right) => {
    const lm =
      left.upcomingTrips[0]?.startTime.displayMinutes ??
      Number.MAX_SAFE_INTEGER;
    const rm =
      right.upcomingTrips[0]?.startTime.displayMinutes ??
      Number.MAX_SAFE_INTEGER;
    return lm !== rm ? lm - rm : left.route.id - right.route.id;
  });
}
