import type { AppLocale } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type {
  BusCampusSummary,
  BusDashboardSnapshot,
  BusMapActiveTrip,
  BusMapCampusNode,
  BusMapData,
  BusMapRouteEdge,
  BusNextDeparturesResult,
  BusPreferencePayload,
  BusResolvedDayType,
  BusRouteListing,
  BusRouteStopSummary,
  BusRouteSummary,
  BusRouteTimetable,
  BusTimetableData,
  BusTimetableInput,
  BusTripSlot,
  BusTripStopTime,
  BusTripSummary,
  BusUserPreferenceSummary,
} from "./bus-types";

type RouteRecord = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  stops: BusRouteStopSummary[];
};

type BusComputedStopTime = BusTripStopTime & {
  displayTime: string | null;
  displayMinutes: number | null;
  isEstimated: boolean;
};

type BusApplicableTrip = {
  trip: BusTripSummary;
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  startTime: BusComputedStopTime;
  endTime: BusComputedStopTime;
  status: "upcoming" | "departed";
  minutesUntilDeparture: number | null;
};

type BusApplicableRoute = {
  route: BusRouteSummary;
  startStop: BusRouteStopSummary;
  endStop: BusRouteStopSummary;
  visibleTrips: BusApplicableTrip[];
  upcomingTrips: BusApplicableTrip[];
};

const busVersionRuntimeSelect = {
  id: true,
  key: true,
  title: true,
  sourceMessage: true,
  sourceUrl: true,
  effectiveFrom: true,
  effectiveUntil: true,
  importedAt: true,
} as const;

type BusVersionRuntime = {
  id: number;
  key: string;
  title: string;
  sourceMessage: string | null;
  sourceUrl: string | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  importedAt: Date;
};

function hhmmToMinutes(value: string | null) {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText ?? "", 10);
  const minute = Number.parseInt(minuteText ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function formatMinutesAsTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function resolveBusDayType(
  inputDayType: BusResolvedDayType | undefined,
  now = shanghaiDayjs(),
): "weekday" | "weekend" {
  if (inputDayType === "weekday" || inputDayType === "weekend") {
    return inputDayType;
  }
  const day = now.day();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

function toDateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isVersionEffectiveOn(
  version: { effectiveFrom: Date | null; effectiveUntil: Date | null },
  dateKey: string,
) {
  const from = toDateKey(version.effectiveFrom);
  const until = toDateKey(version.effectiveUntil);
  if (from && dateKey < from) return false;
  if (until && dateKey > until) return false;
  return true;
}

function describeRoute(
  locale: AppLocale,
  stops: BusRouteStopSummary[],
): { descriptionPrimary: string; descriptionSecondary: string | null } {
  const primaryNames = stops.map((stop) => stop.campus.namePrimary);
  const secondaryNames = stops
    .map((stop) => stop.campus.nameSecondary)
    .filter((name): name is string => Boolean(name));

  return {
    descriptionPrimary: primaryNames.join(" -> "),
    descriptionSecondary:
      locale === "en-us" && secondaryNames.length === stops.length
        ? secondaryNames.join(" -> ")
        : locale === "zh-cn" && secondaryNames.length === stops.length
          ? secondaryNames.join(" -> ")
          : null,
  };
}

function buildRouteSummary(
  locale: AppLocale,
  route: RouteRecord,
): BusRouteSummary | null {
  if (route.stops.length < 2) return null;
  const description = describeRoute(locale, route.stops);
  return {
    id: route.id,
    nameCn: route.nameCn,
    nameEn: route.nameEn,
    descriptionPrimary: description.descriptionPrimary,
    descriptionSecondary: description.descriptionSecondary,
    stops: route.stops,
  };
}

async function findEffectiveBusVersion(
  dateKey: string,
  versionKey?: string | null,
) {
  if (versionKey) {
    return prisma.busScheduleVersion.findUnique({
      where: { key: versionKey },
      select: busVersionRuntimeSelect,
    });
  }

  const versions = await listEnabledBusVersionRecords();

  return findEffectiveBusVersionFromRecords(versions, dateKey);
}

function findEffectiveBusVersionFromRecords(
  versions: BusVersionRuntime[],
  dateKey: string,
) {
  return (
    versions.find((version) => isVersionEffectiveOn(version, dateKey)) ??
    versions[0] ??
    null
  );
}

async function listEnabledBusVersionRecords() {
  return prisma.busScheduleVersion.findMany({
    where: { isEnabled: true },
    select: busVersionRuntimeSelect,
    orderBy: [
      { effectiveFrom: "desc" },
      { importedAt: "desc" },
      { id: "desc" },
    ],
  });
}

function summarizeBusVersions(versions: BusVersionRuntime[]) {
  return versions.map((version) => ({
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
  }));
}

async function getVersionRouteIds(versionId: number) {
  const routeRows = await prisma.busTrip.findMany({
    where: { versionId },
    select: { routeId: true },
    distinct: ["routeId"],
  });

  return new Set(routeRows.map((row) => row.routeId));
}

async function getRouteRecords(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const routes = await localizedPrisma.busRoute.findMany({
    include: {
      stops: {
        orderBy: { stopOrder: "asc" },
        include: {
          campus: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return routes.map<RouteRecord>((route) => ({
    id: route.id,
    nameCn: route.nameCn,
    nameEn: route.nameEn,
    stops: route.stops.map((stop) => ({
      stopOrder: stop.stopOrder,
      campus: {
        id: stop.campus.id,
        nameCn: stop.campus.nameCn,
        nameEn: stop.campus.nameEn,
        namePrimary: stop.campus.namePrimary,
        nameSecondary: stop.campus.nameSecondary,
        latitude: stop.campus.latitude,
        longitude: stop.campus.longitude,
      },
    })),
  }));
}

async function getBusCampuses(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const campuses = await localizedPrisma.busCampus.findMany({
    orderBy: { id: "asc" },
  });

  return campuses.map<BusCampusSummary>((campus) => ({
    id: campus.id,
    nameCn: campus.nameCn,
    nameEn: campus.nameEn,
    namePrimary: campus.namePrimary,
    nameSecondary: campus.nameSecondary,
    latitude: campus.latitude,
    longitude: campus.longitude,
  }));
}

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

  return {
    ...data,
  } satisfies BusUserPreferenceSummary;
}

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
      minutesSinceMidnight: hhmmToMinutes(time),
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

function estimateStopMinutes(
  stopTimes: BusTripStopTime[],
  stopIndex: number,
): { minutes: number | null; isEstimated: boolean } {
  const exact = stopTimes[stopIndex]?.minutesSinceMidnight ?? null;
  if (exact != null) {
    return { minutes: exact, isEstimated: false };
  }

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
    return {
      minutes: Math.round((previous + next) / 2),
      isEstimated: true,
    };
  }

  if (previous != null || next != null) {
    return {
      minutes: previous ?? next,
      isEstimated: true,
    };
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

function buildApplicableBusRoutes(input: {
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

      if (!startStop || !endStop || startStop.stopOrder >= endStop.stopOrder) {
        return [];
      }

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
          const leftMinutes =
            left.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
          const rightMinutes =
            right.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
          if (leftMinutes !== rightMinutes) {
            return leftMinutes - rightMinutes;
          }
          return left.trip.position - right.trip.position;
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
      const leftMinutes =
        left.upcomingTrips[0]?.startTime.displayMinutes ??
        Number.MAX_SAFE_INTEGER;
      const rightMinutes =
        right.upcomingTrips[0]?.startTime.displayMinutes ??
        Number.MAX_SAFE_INTEGER;
      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }
      return left.route.id - right.route.id;
    });
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
      where: {
        versionId: version.id,
      },
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

  return {
    data,
  };
}

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
      const leftMinutes = left.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      const rightMinutes =
        right.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }
      return left.routeId - right.routeId;
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

/* ------------------------------------------------------------------ */
/*  Route catalog (MCP: list_bus_routes)                               */
/* ------------------------------------------------------------------ */

function toRouteListing(
  locale: AppLocale,
  route: RouteRecord,
): BusRouteListing | null {
  if (route.stops.length < 2) return null;
  const desc = describeRoute(locale, route.stops);
  return {
    id: route.id,
    nameCn: route.nameCn,
    nameEn: route.nameEn,
    descriptionPrimary: desc.descriptionPrimary,
    stops: route.stops.map((s) => ({
      stopOrder: s.stopOrder,
      campusId: s.campus.id,
      campusName: s.campus.namePrimary,
    })),
  };
}

export async function listBusRoutes(
  locale: AppLocale,
): Promise<{ routes: BusRouteListing[]; campuses: BusCampusSummary[] }> {
  const dateKey = shanghaiDayjs().format("YYYY-MM-DD");
  const version = await findEffectiveBusVersion(dateKey);

  const [records, campuses, versionRouteIds] = await Promise.all([
    getRouteRecords(locale),
    getBusCampuses(locale),
    version
      ? getVersionRouteIds(version.id)
      : Promise.resolve(new Set<number>()),
  ]);
  const routes = records
    .filter((record) => versionRouteIds.has(record.id))
    .map((r) => toRouteListing(locale, r))
    .filter((r): r is BusRouteListing => r != null);
  return { routes, campuses };
}

/* ------------------------------------------------------------------ */
/*  Single-route timetable (MCP: get_bus_route_timetable)              */
/* ------------------------------------------------------------------ */

export async function getBusRouteTimetable(input: {
  routeId: number;
  locale: AppLocale;
  now?: string;
  versionKey?: string | null;
}): Promise<BusRouteTimetable | null> {
  const locale = input.locale;
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");
  const version = await findEffectiveBusVersion(dateKey, input.versionKey);
  if (!version) return null;

  const records = await getRouteRecords(locale);
  const record = records.find((r) => r.id === input.routeId);
  if (!record) return null;
  const listing = toRouteListing(locale, record);
  if (!listing) return null;

  const routeTrips = await prisma.busTrip.findMany({
    where: {
      versionId: version.id,
      routeId: input.routeId,
    },
    orderBy: [{ dayType: "asc" }, { position: "asc" }],
  });
  const weekdayTrips = routeTrips.filter((trip) => trip.dayType === "weekday");
  const weekendTrips = routeTrips.filter((trip) => trip.dayType === "weekend");

  const toSlots = (trips: typeof weekdayTrips): BusTripSlot[] =>
    trips.map((t) => ({
      position: t.position,
      stopTimes: (t.stopTimes as Array<string | null>).map((time, i) => ({
        stopOrder: i,
        time,
      })),
    }));

  // Find alternate routes: same first→last campus pair, different route ID
  const firstCampusId = record.stops[0]?.campus.id;
  const lastCampusId = record.stops[record.stops.length - 1]?.campus.id;
  const alternateRoutes = records
    .filter((r) => {
      if (r.id === input.routeId || r.stops.length < 2) return false;
      const rFirst = r.stops[0]?.campus.id;
      const rLast = r.stops[r.stops.length - 1]?.campus.id;
      return rFirst === firstCampusId && rLast === lastCampusId;
    })
    .map((r) => toRouteListing(locale, r))
    .filter((r): r is BusRouteListing => r != null);

  return {
    route: listing,
    weekday: toSlots(weekdayTrips),
    weekend: toSlots(weekendTrips),
    alternateRoutes,
  };
}

/* ------------------------------------------------------------------ */
/*  Transit map data                                                   */
/* ------------------------------------------------------------------ */

export async function getBusMapData(input: {
  locale: AppLocale;
  now?: string;
  versionKey?: string | null;
}): Promise<BusMapData | null> {
  const locale = input.locale;
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");
  const todayType = resolveBusDayType(undefined, now);
  const version = await findEffectiveBusVersion(dateKey, input.versionKey);
  if (!version) return null;

  const [records, campuses, allTrips] = await Promise.all([
    getRouteRecords(locale),
    getBusCampuses(locale),
    prisma.busTrip.findMany({
      where: { versionId: version.id },
      orderBy: [{ dayType: "asc" }, { routeId: "asc" }, { position: "asc" }],
    }),
  ]);

  const tripCounts = new Map<number, { weekday: number; weekend: number }>();
  for (const trip of allTrips) {
    const count = tripCounts.get(trip.routeId) ?? { weekday: 0, weekend: 0 };
    count[trip.dayType] += 1;
    tripCounts.set(trip.routeId, count);
  }

  const campusNodes: BusMapCampusNode[] = campuses.map((c) => ({
    id: c.id,
    namePrimary: c.namePrimary,
    nameSecondary: c.nameSecondary,
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  const routeEdges: BusMapRouteEdge[] = records
    .filter((r) => r.stops.length >= 2)
    .map((r) => {
      const desc = describeRoute(locale, r.stops);
      return {
        routeId: r.id,
        descriptionPrimary: desc.descriptionPrimary,
        stops: r.stops.map((s) => ({
          campusId: s.campus.id,
          campusName: s.campus.namePrimary,
        })),
        weekdayTrips: tripCounts.get(r.id)?.weekday ?? 0,
        weekendTrips: tripCounts.get(r.id)?.weekend ?? 0,
      };
    });

  // Determine active/upcoming trips
  const nowMinutes = now.hour() * 60 + now.minute();
  const activeTrips: BusMapActiveTrip[] = [];

  for (const trip of allTrips.filter((item) => item.dayType === todayType)) {
    const stopTimes = trip.stopTimes as Array<string | null>;
    const parsedTimes = stopTimes.map((t) => hhmmToMinutes(t));
    const firstTime = parsedTimes.find((t) => t != null);
    const lastTime = [...parsedTimes].reverse().find((t) => t != null);
    if (firstTime == null || lastTime == null) continue;

    // En-route: now is between first departure and last arrival
    if (nowMinutes >= firstTime && nowMinutes <= lastTime) {
      // Interpolate position between stops
      let fromOrder: number | null = null;
      let toOrder: number | null = null;
      let progress: number | null = null;
      for (let i = 0; i < parsedTimes.length - 1; i++) {
        const a = parsedTimes[i];
        const b = parsedTimes[i + 1];
        if (a != null && b != null && nowMinutes >= a && nowMinutes <= b) {
          fromOrder = i;
          toOrder = i + 1;
          progress = b > a ? (nowMinutes - a) / (b - a) : 0;
          break;
        }
      }
      activeTrips.push({
        tripId: trip.id,
        routeId: trip.routeId,
        status: "en-route",
        departureTime: stopTimes[0] ?? null,
        arrivalTime: stopTimes[stopTimes.length - 1] ?? null,
        fromStopOrder: fromOrder,
        toStopOrder: toOrder,
        segmentProgress:
          progress != null ? Math.round(progress * 100) / 100 : null,
      });
    }
    // Departing soon: departs within next 60 minutes
    else if (firstTime > nowMinutes && firstTime <= nowMinutes + 60) {
      activeTrips.push({
        tripId: trip.id,
        routeId: trip.routeId,
        status: "departing-soon",
        departureTime: stopTimes[0] ?? null,
        arrivalTime: stopTimes[stopTimes.length - 1] ?? null,
        fromStopOrder: null,
        toStopOrder: null,
        segmentProgress: null,
      });
    }
  }

  return {
    campuses: campusNodes,
    routes: routeEdges,
    activeTrips,
    todayType,
    now: now.toISOString(),
  };
}
