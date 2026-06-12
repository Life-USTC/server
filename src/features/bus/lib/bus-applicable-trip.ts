import type { BusComputedStopTime } from "./bus-stop-time-computation";
import { buildComputedStopTime } from "./bus-stop-time-computation";
import type {
  BusRouteStopSummary,
  BusRouteSummary,
  BusTripSummary,
} from "./bus-types";

export type BusApplicableTrip = {
  trip: BusTripSummary;
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  startTime: BusComputedStopTime;
  endTime: BusComputedStopTime;
  status: "upcoming" | "departed";
  minutesUntilDeparture: number | null;
};

export function buildApplicableBusTrip(input: {
  endIndex: number;
  endStop: BusRouteStopSummary;
  nowMinutes: number;
  route: BusRouteSummary;
  startIndex: number;
  startStop: BusRouteStopSummary;
  trip: BusTripSummary;
}): BusApplicableTrip {
  const stopTimes = input.trip.stopTimes.map((_, index) =>
    buildComputedStopTime(input.trip.stopTimes, index),
  );
  const startTime = stopTimes[input.startIndex];
  const endTime = stopTimes[input.endIndex];
  const status =
    startTime.displayMinutes == null ||
    startTime.displayMinutes >= input.nowMinutes
      ? "upcoming"
      : "departed";

  return {
    trip: input.trip,
    route: input.route,
    startStop: input.startStop,
    endStop: input.endStop,
    startTime,
    endTime,
    status,
    minutesUntilDeparture:
      startTime.displayMinutes == null
        ? null
        : startTime.displayMinutes - input.nowMinutes,
  };
}
