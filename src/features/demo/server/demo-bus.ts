import {
  buildNextBusDeparturesFromData,
  resolveBusDayType,
} from "@/features/bus/lib/bus-departures";
import { buildBusMapActiveTrips } from "@/features/bus/lib/bus-map-active-trips";
import {
  buildBusRouteEdges,
  buildBusRouteTripCounts,
} from "@/features/bus/lib/bus-map-route-edges";
import { searchBusRoutesFromData } from "@/features/bus/lib/bus-route-search";
import type {
  BusMapData,
  BusTimetableData,
} from "@/features/bus/lib/bus-types";
import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export const DEMO_BUS_VERSION = "demo-reference-2026";
export const DEMO_BUS_HUB = 153201;
const departureMinutes = [545, 560, 575, 590, 605];
const timeLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** One closed graph shared by the planner, read APIs, schematic map and Home. */
export function getDemoBusTimetable(
  locale: AppLocale,
  versionKey?: string | null,
): BusTimetableData | null {
  if (versionKey != null && versionKey !== DEMO_BUS_VERSION) return null;
  const english = locale === "en-us";
  const notice = {
    message: english
      ? "Fictional timetable and schematic locations · Not a real school bus service"
      : "虚构班次和示意站点 · 非真实校车服务",
    url: null,
  };
  const version = {
    id: 153200,
    key: DEMO_BUS_VERSION,
    title: english ? "Fictional sample timetable" : "虚构样例时刻表",
    effectiveFrom: "2026-09-01T00:00:00+08:00",
    effectiveUntil: "2027-01-31T23:59:59+08:00",
    importedAt: DEMO_REFERENCE_NOW,
    notice,
  };
  const campuses = Array.from({ length: 6 }, (_, index) => {
    const nameCn = index ? `虚构目的地 ${index}` : "虚构样例校区";
    const nameEn = index ? `Sample destination ${index}` : "Sample Campus";
    return {
      id: DEMO_BUS_HUB + index,
      nameCn,
      nameEn,
      namePrimary: english ? nameEn : nameCn,
      nameSecondary: english ? nameCn : nameEn,
      latitude: 1 + (index % 3) * 0.02,
      longitude: 1 + Math.floor(index / 3) * 0.02,
    };
  });
  const routes = campuses.slice(1).map((campus, index) => ({
    id: 153211 + index,
    nameCn: `虚构线路 ${index + 1}`,
    nameEn: `Sample route ${index + 1}`,
    descriptionPrimary: `${campuses[0].namePrimary} → ${campus.namePrimary}`,
    descriptionSecondary: `${campuses[0].nameSecondary} → ${campus.nameSecondary}`,
    stops: [
      { stopOrder: 0, campus: campuses[0] },
      { stopOrder: 1, campus },
    ],
  }));
  const trips = (["weekday", "saturday", "sunday"] as const).flatMap(
    (dayType, dayIndex) =>
      routes.map((route, index) => ({
        id: 153220 + dayIndex * 5 + index,
        routeId: route.id,
        dayType,
        position: 0,
        departureTime: timeLabel(departureMinutes[index]),
        departureMinutes: departureMinutes[index],
        arrivalTime: timeLabel(departureMinutes[index] + 20),
        arrivalMinutes: departureMinutes[index] + 20,
        stopTimes: route.stops.map((stop, stopIndex) => ({
          stopOrder: stop.stopOrder,
          campusId: stop.campus.id,
          campusName: stop.campus.namePrimary,
          time: timeLabel(departureMinutes[index] + stopIndex * 20),
          minutesSinceMidnight: departureMinutes[index] + stopIndex * 20,
          isPassThrough: false,
        })),
      })),
  );
  return {
    locale,
    fetchedAt: DEMO_REFERENCE_NOW,
    version,
    availableVersions: [version],
    campuses,
    routes,
    trips,
    preferences: null,
    notice,
  };
}

export function isDemoBusTime(atTime: string) {
  const value = shanghaiDayjs(atTime);
  return (
    value.isValid() &&
    value.valueOf() >= Date.parse("2026-09-01T00:00:00+08:00") &&
    value.valueOf() <= Date.parse("2027-01-31T23:59:59+08:00")
  );
}

export function getDemoBusNext(
  locale: AppLocale,
  input: {
    originCampusId: number;
    destinationCampusId: number;
    atTime?: string;
    dayType?: "auto" | "weekday" | "saturday" | "sunday";
    limit?: number;
    includeDeparted?: boolean;
    versionKey?: string | null;
  },
) {
  const data = getDemoBusTimetable(locale, input.versionKey);
  if (
    !data?.campuses.some(({ id }) => id === input.originCampusId) ||
    !data.campuses.some(({ id }) => id === input.destinationCampusId) ||
    (input.atTime !== undefined && !isDemoBusTime(input.atTime))
  )
    return null;
  return buildNextBusDeparturesFromData(data, {
    ...input,
    atTime: input.atTime ?? DEMO_REFERENCE_NOW,
  });
}

export function getDemoBusMap(
  locale: AppLocale,
  versionKey?: string | null,
): BusMapData | null {
  const data = getDemoBusTimetable(locale, versionKey);
  if (!data) return null;
  const reference = shanghaiDayjs(DEMO_REFERENCE_NOW);
  const todayType = resolveBusDayType("auto", reference);
  return {
    campuses: data.campuses.map(
      ({ id, namePrimary, nameSecondary, latitude, longitude }) => ({
        id,
        namePrimary,
        nameSecondary,
        latitude,
        longitude,
      }),
    ),
    routes: buildBusRouteEdges({
      locale,
      records: data.routes,
      tripCounts: buildBusRouteTripCounts(data.trips),
    }),
    activeTrips: buildBusMapActiveTrips({
      nowMinutes: reference.hour() * 60 + reference.minute(),
      todayType,
      trips: data.trips.map((trip) => ({
        ...trip,
        stopTimes: trip.stopTimes.map((stop) => stop.time),
      })),
    }),
    todayType,
    now: DEMO_REFERENCE_NOW,
  };
}

export function getDemoBusRoutes(
  locale: AppLocale,
  input: {
    originCampusId?: number;
    destinationCampusId?: number;
    versionKey?: string | null;
  },
) {
  const data = getDemoBusTimetable(locale, input.versionKey);
  if (
    !data ||
    [input.originCampusId, input.destinationCampusId].some(
      (id) => id != null && !data.campuses.some((campus) => campus.id === id),
    )
  )
    return null;
  return searchBusRoutesFromData(data, input);
}
