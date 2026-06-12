import type {
  BusRouteStopSummary,
  BusRouteSummary,
  BusTripStatus,
  BusTripStopTime,
  BusTripSummary,
} from "./bus-types";

export type BusComputedStopTime = BusTripStopTime & {
  displayTime: string | null;
  displayMinutes: number | null;
  isEstimated: boolean;
};

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
