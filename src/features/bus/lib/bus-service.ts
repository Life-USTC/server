import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { buildNextBusDeparturesFromData } from "./bus-departures";
import {
  buildRouteSummary,
  getBusCampuses,
  getRouteRecords,
} from "./bus-route-builder";
import { parseBusTimeMinutes } from "./bus-time";
import type {
  BusDashboardSnapshot,
  BusNextDeparturesResult,
  BusPreferencePayload,
  BusResolvedDayType,
  BusRouteSummary,
  BusTimetableData,
  BusTimetableInput,
  BusTripStopTime,
  BusTripSummary,
  BusUserPreferenceSummary,
} from "./bus-types";
import {
  findEffectiveBusVersion,
  findEffectiveBusVersionFromRecords,
  listEnabledBusVersionRecords,
  summarizeBusVersions,
} from "./bus-version";

/* ------------------------------------------------------------------ */
/*  Re-exports — callers can still import from bus-service             */
/* ------------------------------------------------------------------ */

export { getBusRouteTimetable, listBusRoutes } from "./bus-catalog";
export {
  buildNextBusDeparturesFromData,
  resolveBusDayType,
} from "./bus-departures";
export { getBusMapData } from "./bus-transit-map";

/* ------------------------------------------------------------------ */
/*  Preferences                                                        */
/* ------------------------------------------------------------------ */

export async function getBusPreference(
  userId: string | null,
): Promise<BusUserPreferenceSummary | null> {
  if (!userId) return null;

  const preference = await prisma.busUserPreference.findUnique({
    where: { userId },
  });

  if (!preference) {
    return {
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    };
  }

  return {
    preferredOriginCampusId: preference.preferredOriginCampusId,
    preferredDestinationCampusId: preference.preferredDestinationCampusId,
    showDepartedTrips: preference.showDepartedTrips,
  };
}

export async function saveBusPreference(
  userId: string,
  payload: BusPreferencePayload,
) {
  const data = {
    preferredOriginCampusId: payload.preferredOriginCampusId,
    preferredDestinationCampusId: payload.preferredDestinationCampusId,
    favoriteCampusIds: [] as number[],
    favoriteRouteIds: [] as number[],
    showDepartedTrips: payload.showDepartedTrips,
  };

  await prisma.busUserPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return { ...data } satisfies BusUserPreferenceSummary;
}

/* ------------------------------------------------------------------ */
/*  Timetable data assembly                                            */
/* ------------------------------------------------------------------ */

function buildTripSummary(
  trip: {
    id: number;
    routeId: number;
    dayType: "weekday" | "weekend";
    position: number;
    stopTimes: unknown;
  },
  route: BusRouteSummary,
): BusTripSummary {
  const rawTimes = Array.isArray(trip.stopTimes)
    ? (trip.stopTimes as Array<string | null>)
    : [];

  const stopTimes = route.stops.map<BusTripStopTime>((stop, index) => {
    const time = rawTimes[index] ?? null;
    return {
      stopOrder: stop.stopOrder,
      campusId: stop.campus.id,
      campusName: stop.campus.namePrimary,
      time,
      minutesSinceMidnight: parseBusTimeMinutes(time),
      isPassThrough: time == null,
    };
  });

  const departureTime = stopTimes[0]?.time ?? null;
  const departureMinutes = stopTimes[0]?.minutesSinceMidnight ?? null;
  const arrivalTime = stopTimes[stopTimes.length - 1]?.time ?? null;
  const arrivalMinutes =
    stopTimes[stopTimes.length - 1]?.minutesSinceMidnight ?? null;

  return {
    id: trip.id,
    routeId: route.id,
    dayType: trip.dayType,
    position: trip.position,
    stopTimes,
    departureTime,
    departureMinutes,
    arrivalTime,
    arrivalMinutes,
  };
}

export async function getBusTimetableData(
  input: BusTimetableInput,
): Promise<BusTimetableData | null> {
  const locale = input.locale ?? "zh-cn";
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");

  const versionRecords = await listEnabledBusVersionRecords();
  const version = input.versionKey
    ? await findEffectiveBusVersion(dateKey, input.versionKey)
    : findEffectiveBusVersionFromRecords(versionRecords, dateKey);
  if (!version) return null;

  const [routeRecords, campuses, preference, tripRows] = await Promise.all([
    getRouteRecords(locale),
    getBusCampuses(locale),
    getBusPreference(input.userId ?? null),
    prisma.busTrip.findMany({
      where: { versionId: version.id },
      orderBy: [{ dayType: "asc" }, { routeId: "asc" }, { position: "asc" }],
    }),
  ]);

  const versionRouteIds = new Set(tripRows.map((trip) => trip.routeId));
  const routes = routeRecords
    .filter((record) => versionRouteIds.has(record.id))
    .map((record) => buildRouteSummary(locale, record))
    .filter((record): record is BusRouteSummary => record != null);

  const routeMap = new Map(routes.map((route) => [route.id, route] as const));
  const trips = tripRows
    .map((trip) => {
      const route = routeMap.get(trip.routeId);
      if (!route) return null;
      return buildTripSummary(trip, route);
    })
    .filter((trip): trip is BusTripSummary => trip != null);

  return {
    locale,
    fetchedAt: now.toISOString(),
    version: {
      id: version.id,
      key: version.key,
      title: version.title,
      effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
      importedAt: version.importedAt.toISOString(),
      notice:
        version.sourceMessage || version.sourceUrl
          ? {
              message: version.sourceMessage ?? null,
              url: version.sourceUrl ?? null,
            }
          : null,
    },
    campuses,
    routes,
    trips,
    availableVersions: summarizeBusVersions(versionRecords),
    preferences: preference,
    notice:
      version.sourceMessage || version.sourceUrl
        ? {
            message: version.sourceMessage ?? null,
            url: version.sourceUrl ?? null,
          }
        : null,
  };
}

export async function getBusDashboardSnapshot(
  input: Pick<BusTimetableInput, "locale" | "userId" | "now">,
): Promise<BusDashboardSnapshot | null> {
  const data = await getBusTimetableData({
    locale: input.locale,
    userId: input.userId,
    now: input.now,
  });

  if (!data) return null;
  return { data };
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
  const data = await getBusTimetableData({
    locale: input.locale,
    now: now.toISOString(),
    versionKey: input.versionKey,
    userId: input.userId,
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

  const tripCounts = new Map<number, { weekday: number; weekend: number }>();
  for (const trip of data.trips) {
    const count = tripCounts.get(trip.routeId) ?? { weekday: 0, weekend: 0 };
    count[trip.dayType] += 1;
    tripCounts.set(trip.routeId, count);
  }

  const routes = data.routes
    .filter((route) => {
      const stopIds = route.stops.map((stop) => stop.campus.id);
      const hasOrigin =
        input.originCampusId == null || stopIds.includes(input.originCampusId);
      const hasDestination =
        input.destinationCampusId == null ||
        stopIds.includes(input.destinationCampusId);
      if (!hasOrigin || !hasDestination) return false;
      if (
        input.originCampusId != null &&
        input.destinationCampusId != null &&
        input.originCampusId !== input.destinationCampusId
      ) {
        const originIndex = route.stops.findIndex(
          (stop) => stop.campus.id === input.originCampusId,
        );
        const destinationIndex = route.stops.findIndex(
          (stop) => stop.campus.id === input.destinationCampusId,
        );
        return originIndex >= 0 && destinationIndex > originIndex;
      }
      return true;
    })
    .map((route) => ({
      id: route.id,
      nameCn: route.nameCn,
      nameEn: route.nameEn,
      descriptionPrimary: route.descriptionPrimary,
      descriptionSecondary: route.descriptionSecondary,
      originCampus: route.stops[0]?.campus ?? null,
      destinationCampus: route.stops[route.stops.length - 1]?.campus ?? null,
      stopCount: route.stops.length,
      weekdayTrips: tripCounts.get(route.id)?.weekday ?? 0,
      weekendTrips: tripCounts.get(route.id)?.weekend ?? 0,
      stops: route.stops,
    }))
    .sort((left, right) => left.id - right.id);

  return {
    originCampus:
      input.originCampusId != null
        ? (data.campuses.find((campus) => campus.id === input.originCampusId) ??
          null)
        : null,
    destinationCampus:
      input.destinationCampusId != null
        ? (data.campuses.find(
            (campus) => campus.id === input.destinationCampusId,
          ) ?? null)
        : null,
    total: routes.length,
    routes,
  };
}
