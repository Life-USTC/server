import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveApplicableRouteStops } from "../lib/bus-applicable-route-helpers";
import { buildNextBusDeparturesFromData } from "../lib/bus-departures";
import { searchBusRoutesFromData } from "../lib/bus-route-search";
import type {
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
