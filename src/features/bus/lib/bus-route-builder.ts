import type { AppLocale } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import type { BusRouteStopSummary, BusRouteSummary } from "./bus-types";

export type RouteRecord = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  stops: BusRouteStopSummary[];
};

export function describeRoute(
  _locale: AppLocale,
  stops: BusRouteStopSummary[],
): { descriptionPrimary: string; descriptionSecondary: string | null } {
  const primaryNames = stops.map((stop) => stop.campus.namePrimary);
  const secondaryNames = stops
    .map((stop) => stop.campus.nameSecondary)
    .filter((name): name is string => Boolean(name));

  return {
    descriptionPrimary: primaryNames.join(" -> "),
    descriptionSecondary:
      secondaryNames.length === stops.length
        ? secondaryNames.join(" -> ")
        : null,
  };
}

export function formatMinutesAsTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function buildRouteSummary(
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

export async function getRouteRecords(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const routes = await localizedPrisma.busRoute.findMany({
    include: {
      stops: {
        orderBy: { stopOrder: "asc" },
        include: { campus: true },
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

export async function getBusCampuses(locale: AppLocale) {
  const localizedPrisma = getPrisma(locale);
  const campuses = await localizedPrisma.busCampus.findMany({
    orderBy: { id: "asc" },
  });

  return campuses.map((campus) => ({
    id: campus.id,
    nameCn: campus.nameCn,
    nameEn: campus.nameEn,
    namePrimary: campus.namePrimary,
    nameSecondary: campus.nameSecondary,
    latitude: campus.latitude,
    longitude: campus.longitude,
  }));
}

export async function getVersionRouteIds(versionId: number) {
  const routeRows = await prisma.busTrip.findMany({
    where: { versionId },
    select: { routeId: true },
    distinct: ["routeId"],
  });
  return new Set(routeRows.map((row) => row.routeId));
}
