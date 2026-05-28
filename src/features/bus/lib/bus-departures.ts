import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatMinutesAsTime } from "./bus-route-builder";
import type {
  BusNextDeparturesResult,
  BusResolvedDayType,
  BusRouteStopSummary,
  BusRouteSummary,
  BusTimetableData,
  BusTripStopTime,
  BusTripSummary,
} from "./bus-types";

export function resolveBusDayType(
  inputDayType: BusResolvedDayType | undefined,
  now = shanghaiDayjs(),
): "weekday" | "weekend" {
  if (inputDayType === "weekday" || inputDayType === "weekend") {
    return inputDayType;
  }
  const day = now.day();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

/* ------------------------------------------------------------------ */
/*  Trip computation helpers                                           */
/* ------------------------------------------------------------------ */

type BusComputedStopTime = BusTripStopTime & {
  displayTime: string | null;
  displayMinutes: number | null;
  isEstimated: boolean;
};

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

export type BusApplicableRoute = {
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  visibleTrips: BusApplicableTrip[];
  upcomingTrips: BusApplicableTrip[];
};

function estimateStopMinutes(
  stopTimes: BusTripStopTime[],
  stopIndex: number,
): { minutes: number | null; isEstimated: boolean } {
  const exact = stopTimes[stopIndex]?.minutesSinceMidnight ?? null;
  if (exact != null) return { minutes: exact, isEstimated: false };

  let previous: number | null = null;
  for (let index = stopIndex - 1; index >= 0; index -= 1) {
    const minutes = stopTimes[index]?.minutesSinceMidnight ?? null;
    if (minutes != null) {
      previous = minutes;
      break;
    }
  }

  let next: number | null = null;
  for (let index = stopIndex + 1; index < stopTimes.length; index += 1) {
    const minutes = stopTimes[index]?.minutesSinceMidnight ?? null;
    if (minutes != null) {
      next = minutes;
      break;
    }
  }

  if (previous != null && next != null) {
    return { minutes: Math.round((previous + next) / 2), isEstimated: true };
  }

  if (previous != null || next != null) {
    return { minutes: previous ?? next, isEstimated: true };
  }

  return { minutes: null, isEstimated: false };
}

function buildComputedStopTime(
  stopTimes: BusTripStopTime[],
  stopIndex: number,
): BusComputedStopTime {
  const stopTime = stopTimes[stopIndex];
  const estimated = estimateStopMinutes(stopTimes, stopIndex);
  const displayMinutes = estimated.minutes;
  const displayTime =
    stopTime?.time ??
    (displayMinutes != null ? formatMinutesAsTime(displayMinutes) : null);

  return {
    ...stopTime,
    displayTime,
    displayMinutes,
    isEstimated: estimated.isEstimated,
  };
}

function getShanghaiMinutesSinceMidnight(now: Date | string) {
  const shanghaiNow = shanghaiDayjs(now);
  return shanghaiNow.hour() * 60 + shanghaiNow.minute();
}

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

  return data.routes
    .flatMap<BusApplicableRoute>((route) => {
      const startStop = route.stops.find(
        (stop) => stop.campus.id === originCampusId,
      );
      const endStop = route.stops.find(
        (stop) => stop.campus.id === destinationCampusId,
      );

      if (!startStop || !endStop || startStop.stopOrder >= endStop.stopOrder)
        return [];

      const startIndex = route.stops.findIndex(
        (stop) => stop.stopOrder === startStop.stopOrder,
      );
      const endIndex = route.stops.findIndex(
        (stop) => stop.stopOrder === endStop.stopOrder,
      );

      const allTrips = data.trips
        .filter((trip) => trip.routeId === route.id && trip.dayType === dayType)
        .map<BusApplicableTrip>((trip) => {
          const stopTimes = trip.stopTimes.map((_, index) =>
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
            startStop,
            endStop,
            startTime,
            endTime,
            status,
            minutesUntilDeparture:
              startTime.displayMinutes == null
                ? null
                : startTime.displayMinutes - nowMinutes,
          };
        })
        .sort((left, right) => {
          const lm = left.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
          const rm = right.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
          return lm !== rm ? lm - rm : left.trip.position - right.trip.position;
        });

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
    })
    .sort((left, right) => {
      const lm =
        left.upcomingTrips[0]?.startTime.displayMinutes ??
        Number.MAX_SAFE_INTEGER;
      const rm =
        right.upcomingTrips[0]?.startTime.displayMinutes ??
        Number.MAX_SAFE_INTEGER;
      return lm !== rm ? lm - rm : left.route.id - right.route.id;
    });
}

/* ------------------------------------------------------------------ */
/*  Next departures (pure computation from timetable data)             */
/* ------------------------------------------------------------------ */

export function buildNextBusDeparturesFromData(
  data: BusTimetableData,
  input: {
    originCampusId: number;
    destinationCampusId: number;
    atTime?: string;
    dayType?: BusResolvedDayType;
    limit?: number;
    includeDeparted?: boolean;
    includeNextAvailableGuidance?: boolean;
  },
): BusNextDeparturesResult {
  const now = input.atTime ? shanghaiDayjs(input.atTime) : shanghaiDayjs();
  const dayType = resolveBusDayType(input.dayType, now);
  const originCampus =
    data.campuses.find((campus) => campus.id === input.originCampusId) ?? null;
  const destinationCampus =
    data.campuses.find((campus) => campus.id === input.destinationCampusId) ??
    null;

  const applicableRoutes = buildApplicableBusRoutes({
    data,
    dayType,
    originCampusId: input.originCampusId,
    destinationCampusId: input.destinationCampusId,
    showDepartedTrips: input.includeDeparted ?? false,
    now: now.toDate(),
  });

  const departures = applicableRoutes
    .flatMap((route) =>
      route.visibleTrips.map((trip) => ({
        tripId: trip.trip.id,
        routeId: route.route.id,
        route: {
          id: route.route.id,
          nameCn: route.route.nameCn,
          nameEn: route.route.nameEn,
          descriptionPrimary: route.route.descriptionPrimary,
          descriptionSecondary: route.route.descriptionSecondary,
        },
        originCampus,
        destinationCampus,
        departureTime: trip.startTime.displayTime,
        arrivalTime: trip.endTime.displayTime,
        departureEstimated: trip.startTime.isEstimated,
        arrivalEstimated: trip.endTime.isEstimated,
        minutesUntilDeparture: trip.minutesUntilDeparture,
        dayType: trip.trip.dayType,
        status: trip.status,
      })),
    )
    .sort((left, right) => {
      const lm = left.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      const rm = right.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      return lm !== rm ? lm - rm : left.routeId - right.routeId;
    })
    .slice(0, input.limit ?? 5);

  let nextAvailableDeparture: (typeof departures)[number] | null = null;
  if (
    input.includeNextAvailableGuidance !== false &&
    departures.length === 0 &&
    applicableRoutes.length > 0
  ) {
    for (let dayOffset = 1; dayOffset < 7; dayOffset += 1) {
      const probeTime = now
        .add(dayOffset, "day")
        .hour(0)
        .minute(0)
        .second(0)
        .millisecond(0);
      const probeDayType = resolveBusDayType(undefined, probeTime);
      const probeResult = buildNextBusDeparturesFromData(data, {
        originCampusId: input.originCampusId,
        destinationCampusId: input.destinationCampusId,
        atTime: probeTime.toISOString(),
        dayType: probeDayType,
        limit: 1,
        includeDeparted: false,
        includeNextAvailableGuidance: false,
      });
      if (probeResult.departures.length > 0) {
        nextAvailableDeparture = probeResult.departures[0] ?? null;
        break;
      }
    }
  }

  const message =
    departures.length > 0
      ? null
      : applicableRoutes.length === 0
        ? "No shuttle route is available for the requested origin and destination campuses."
        : nextAvailableDeparture
          ? `No more ${dayType} departures are available right now. The next available service is at ${nextAvailableDeparture.departureTime ?? "an estimated time"}.`
          : `No more ${dayType} departures are available in the next 7 days for the requested route.`;

  return {
    originCampus,
    destinationCampus,
    atTime: now.toISOString(),
    dayType,
    totalRoutes: applicableRoutes.length,
    departures,
    nextAvailableDeparture,
    message,
  };
}
