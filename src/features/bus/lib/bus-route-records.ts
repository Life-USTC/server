import type { AppLocale } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import type { BusRouteStopSummary } from "./bus-types";

export type RouteRecord = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  stops: BusRouteStopSummary[];
};

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

export async function getVersionRouteIds(versionId: number) {
  const routeRows = await prisma.busTrip.findMany({
    where: { versionId },
    select: { routeId: true },
    distinct: ["routeId"],
  });
  return new Set(routeRows.map((row) => row.routeId));
}
