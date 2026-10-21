import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveApplicableRouteStops } from "../lib/bus-applicable-route-helpers";
import { buildNextBusDeparturesFromData } from "../lib/bus-departures";
import { searchBusRoutesFromData } from "../lib/bus-route-search";
import type {
  BusCampusSummary,
  BusNextDeparture,
  BusNextDeparturesResult,
  BusResolvedDayType,
  BusRouteSummary,
  BusTimetableData,
} from "../lib/bus-types";
import {
  getBusTimetableData,
  getStaticBusTimetableData,
} from "./bus-timetable-data";

function isRouteCandidate(
  route: BusRouteSummary,
  input: { destinationCampusId: number; originCampusId: number },
) {
  return (
    resolveApplicableRouteStops({
      destinationCampusId: input.destinationCampusId,
      originCampusId: input.originCampusId,
      route,
    }) != null
  );
}

async function getNextBusTimetableData(input: {
  locale: AppLocale;
  now: string;
  originCampusId: number;
  destinationCampusId: number;
  versionKey?: string | null;
}): Promise<BusTimetableData | null> {
  const data = await getStaticBusTimetableData({
    locale: input.locale,
    now: input.now,
    versionKey: input.versionKey,
  });
  if (!data) return null;

  const routes = data.routes.filter((route) =>
    isRouteCandidate(route, {
      destinationCampusId: input.destinationCampusId,
      originCampusId: input.originCampusId,
    }),
  );
  const routeIds = new Set(routes.map((route) => route.id));

  return {
    ...data,
    routes,
    trips: data.trips.filter((trip) => routeIds.has(trip.routeId)),
    preferences: null,
  };
}

export async function getNextBusDepartures(input: {
  locale: AppLocale;
  originCampusId: number;
  destinationCampusId: number;
  atTime?: string;
  dayType?: BusResolvedDayType;
  limit?: number;
  includeDeparted?: boolean;
  versionKey?: string | null;
  userId?: string | null;
}): Promise<BusNextDeparturesResult | null> {
  const now = input.atTime ? shanghaiDayjs(input.atTime) : shanghaiDayjs();
  const data = await getNextBusTimetableData({
    locale: input.locale,
    now: now.toISOString(),
    originCampusId: input.originCampusId,
    destinationCampusId: input.destinationCampusId,
    versionKey: input.versionKey,
  });
  if (!data) return null;

  return buildNextBusDeparturesFromData(data, {
    originCampusId: input.originCampusId,
    destinationCampusId: input.destinationCampusId,
    atTime: now.toISOString(),
    dayType: input.dayType,
    limit: input.limit,
    includeDeparted: input.includeDeparted,
  });
}

export async function searchBusRoutes(input: {
  locale: AppLocale;
  originCampusId?: number;
  destinationCampusId?: number;
  versionKey?: string | null;
}) {
  const data = await getBusTimetableData({
    locale: input.locale,
    versionKey: input.versionKey,
  });
  if (!data) return null;

  return searchBusRoutesFromData(data, input);
}

function nextDeparturesFromCampus(
  timetable: BusTimetableData,
  originCampusId: number,
  atTime: string,
  limit: number,
): BusNextDeparture[] {
  return timetable.campuses
    .map((campus) => campus.id)
    .filter((id) => id !== originCampusId)
    .flatMap((destinationCampusId) =>
      buildNextBusDeparturesFromData(timetable, {
        atTime,
        destinationCampusId,
        includeNextAvailableGuidance: false,
        limit: 1,
        originCampusId,
      }).departures.slice(0, 1),
    )
    .sort(
      (left, right) =>
        (left.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER) -
        (right.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, limit);
}

/**
 * The campus served by the most routes, i.e. the one whose departure board is
 * useful to the widest audience. Derived from the imported topology rather than
 * hardcoded so a future network change moves the hub on its own; ties resolve
 * to the lowest campus id for a stable answer.
 */
function resolveHubCampus(timetable: BusTimetableData) {
  const routeCounts = new Map<number, number>();
  for (const route of timetable.routes) {
    for (const campusId of new Set(route.stops.map((stop) => stop.campus.id))) {
      routeCounts.set(campusId, (routeCounts.get(campusId) ?? 0) + 1);
    }
  }
  return (
    [...timetable.campuses]
      .sort(
        (left, right) =>
          (routeCounts.get(right.id) ?? 0) - (routeCounts.get(left.id) ?? 0) ||
          left.id - right.id,
      )
      .at(0) ?? null
  );
}

/**
 * Departure board for a visitor with no campus preference: the busiest campus
 * and the soonest trip from it to each place it connects to. One timetable read
 * serves both halves.
 */
export async function getNextDeparturesFromHubCampus(input: {
  locale: AppLocale;
  atTime?: string;
  limit?: number;
}): Promise<{
  originCampus: BusCampusSummary;
  departures: BusNextDeparture[];
} | null> {
  const now = input.atTime ? shanghaiDayjs(input.atTime) : shanghaiDayjs();
  const data = await getStaticBusTimetableData({
    locale: input.locale,
    now: now.toISOString(),
  });
  if (!data) return null;

  const timetable: BusTimetableData = { ...data, preferences: null };
  const originCampus = resolveHubCampus(timetable);
  if (!originCampus) return null;

  return {
    departures: nextDeparturesFromCampus(
      timetable,
      originCampus.id,
      now.toISOString(),
      input.limit ?? 3,
    ),
    originCampus,
  };
}
