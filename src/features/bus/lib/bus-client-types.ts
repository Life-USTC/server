import type { BusComputedStopTime } from "./bus-stop-time-computation";
import type {
  BusRouteStopSummary,
  BusRouteSummary,
  BusTripStatus,
  BusTripSummary,
} from "./bus-types";

export type { BusComputedStopTime };

export type BusApplicableTrip = {
  trip: BusTripSummary;
  route: BusRouteSummary;
  stopTimes: BusComputedStopTime[];
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  startTime: BusComputedStopTime;
  endTime: BusComputedStopTime;
  status: BusTripStatus;
  minutesUntilStart: number | null;
};

export type BusApplicableRoute = {
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  nextTrip: BusApplicableTrip | null;
  upcomingTrips: BusApplicableTrip[];
  visibleTrips: BusApplicableTrip[];
  allTrips: BusApplicableTrip[];
  totalTrips: number;
};
