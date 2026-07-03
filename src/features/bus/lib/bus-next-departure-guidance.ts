import type { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  getShanghaiMinutesSinceMidnight,
  resolveApplicableRouteStops,
} from "./bus-applicable-route-helpers";
import { buildApplicableBusTrip } from "./bus-applicable-trip";
import { resolveBusDayType } from "./bus-day-type";
import type {
  BusCampusSummary,
  BusNextDeparture,
  BusNextDeparturesResult,
  BusResolvedDayType,
  BusRouteStopSummary,
  BusRouteSummary,
  BusTimetableData,
  BusTripSummary,
} from "./bus-types";

type ScheduleDayType = ReturnType<typeof resolveBusDayType>;

export function buildNoBusDepartureMessage({
  applicableRouteCount,
  dayType,
  departureCount,
  nextAvailableDeparture,
}: {
  applicableRouteCount: number;
  dayType: BusResolvedDayType;
  departureCount: number;
  nextAvailableDeparture: BusNextDeparturesResult["nextAvailableDeparture"];
}) {
  return departureCount > 0
    ? null
    : applicableRouteCount === 0
      ? "No shuttle route is available for the requested origin and destination campuses."
      : nextAvailableDeparture
        ? `No more ${dayType} departures are available right now. The next available service is at ${nextAvailableDeparture.departureTime ?? "an estimated time"}.`
        : `No more ${dayType} departures are available in the next 7 days for the requested route.`;
}

export function findNextAvailableBusDeparture({
  data,
  destinationCampus,
  destinationCampusId,
  now,
  originCampus,
  originCampusId,
}: {
  data: BusTimetableData;
  destinationCampus: BusCampusSummary | null;
  destinationCampusId: number;
  now: ReturnType<typeof shanghaiDayjs>;
  originCampus: BusCampusSummary | null;
  originCampusId: number;
}) {
  const routeCandidates = data.routes.flatMap<{
    endIndex: number;
    endStop: BusRouteStopSummary;
    route: BusRouteSummary;
    startIndex: number;
    startStop: BusRouteStopSummary;
  }>((route) => {
    const stopSelection = resolveApplicableRouteStops({
      destinationCampusId,
      originCampusId,
      route,
    });

    return stopSelection ? [{ route, ...stopSelection }] : [];
  });
  if (routeCandidates.length === 0) return null;

  const tripsByDayType = indexTripsByDayType(data.trips);
  for (let dayOffset = 1; dayOffset < 7; dayOffset += 1) {
    const probeTime = now
      .add(dayOffset, "day")
      .hour(0)
      .minute(0)
      .second(0)
      .millisecond(0);
    const probeDayType = resolveBusDayType(undefined, probeTime);
    const nextDeparture = findFirstDepartureForDay({
      destinationCampus,
      nowMinutes: getShanghaiMinutesSinceMidnight(probeTime.toDate()),
      originCampus,
      routeCandidates,
      tripsByRoute: tripsByDayType[probeDayType],
    });
    if (nextDeparture) {
      return nextDeparture;
    }
  }

  return null;
}

function indexTripsByDayType(trips: BusTripSummary[]) {
  const tripsByDayType = {
    weekday: new Map<number, BusTripSummary[]>(),
    weekend: new Map<number, BusTripSummary[]>(),
  } satisfies Record<ScheduleDayType, Map<number, BusTripSummary[]>>;

  for (const trip of trips) {
    const tripsByRoute = tripsByDayType[trip.dayType];
    const routeTrips = tripsByRoute.get(trip.routeId);
    if (routeTrips) {
      routeTrips.push(trip);
    } else {
      tripsByRoute.set(trip.routeId, [trip]);
    }
  }

  return tripsByDayType;
}

function findFirstDepartureForDay({
  destinationCampus,
  nowMinutes,
  originCampus,
  routeCandidates,
  tripsByRoute,
}: {
  destinationCampus: BusCampusSummary | null;
  nowMinutes: number;
  originCampus: BusCampusSummary | null;
  routeCandidates: Array<{
    endIndex: number;
    endStop: BusRouteStopSummary;
    route: BusRouteSummary;
    startIndex: number;
    startStop: BusRouteStopSummary;
  }>;
  tripsByRoute: Map<number, BusTripSummary[]>;
}) {
  let firstDeparture: BusNextDeparture | null = null;

  for (const routeCandidate of routeCandidates) {
    for (const trip of tripsByRoute.get(routeCandidate.route.id) ?? []) {
      const applicableTrip = buildApplicableBusTrip({
        endIndex: routeCandidate.endIndex,
        endStop: routeCandidate.endStop,
        nowMinutes,
        route: routeCandidate.route,
        startIndex: routeCandidate.startIndex,
        startStop: routeCandidate.startStop,
        trip,
      });
      if (applicableTrip.status !== "upcoming") continue;

      const departure = {
        tripId: trip.id,
        routeId: routeCandidate.route.id,
        route: {
          id: routeCandidate.route.id,
          nameCn: routeCandidate.route.nameCn,
          nameEn: routeCandidate.route.nameEn,
          descriptionPrimary: routeCandidate.route.descriptionPrimary,
          descriptionSecondary: routeCandidate.route.descriptionSecondary,
        },
        originCampus,
        destinationCampus,
        departureTime: applicableTrip.startTime.displayTime,
        arrivalTime: applicableTrip.endTime.displayTime,
        departureEstimated: applicableTrip.startTime.isEstimated,
        arrivalEstimated: applicableTrip.endTime.isEstimated,
        minutesUntilDeparture: applicableTrip.minutesUntilDeparture,
        dayType: trip.dayType,
        status: applicableTrip.status,
      } satisfies BusNextDeparture;

      if (
        !firstDeparture ||
        compareNextDeparture(departure, firstDeparture) < 0
      ) {
        firstDeparture = departure;
      }
    }
  }

  return firstDeparture;
}

function compareNextDeparture(left: BusNextDeparture, right: BusNextDeparture) {
  const leftMinutes = left.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
  const rightMinutes = right.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
  return leftMinutes !== rightMinutes
    ? leftMinutes - rightMinutes
    : left.routeId - right.routeId;
}
