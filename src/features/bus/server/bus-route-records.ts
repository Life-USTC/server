import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import {
  buildBusRouteNameData,
  normalizeBusCampusName,
} from "../lib/bus-import-route-data";
import type { RouteRecord } from "../lib/bus-route-record-types";
import type {
  BusCampusSummary,
  BusStaticCampus,
  BusStaticPayload,
} from "../lib/bus-types";

export type BusVersionTopology = {
  campuses: BusCampusSummary[];
  routes: RouteRecord[];
};

export async function getVersionRouteIds(versionId: number) {
  const routeRows = await prisma.busTrip.findMany({
    where: { versionId },
    select: { routeId: true },
    distinct: ["routeId"],
  });
  return new Set(routeRows.map((row) => row.routeId));
}

function toCampusSummary(
  _locale: AppLocale,
  campus: BusStaticCampus,
): BusCampusSummary {
  const nameCn = normalizeBusCampusName(campus.name);
  return {
    id: campus.id,
    nameCn,
    nameEn: null,
    namePrimary: nameCn,
    nameSecondary: null,
    latitude: campus.latitude,
    longitude: campus.longitude,
  };
}

export function buildBusVersionTopology(
  locale: AppLocale,
  payload: BusStaticPayload,
): BusVersionTopology {
  const campuses = payload.campuses
    .map((campus) => toCampusSummary(locale, campus))
    .sort((left, right) => left.id - right.id);
  const campusById = new Map(campuses.map((campus) => [campus.id, campus]));

  const routes = payload.routes
    .map<RouteRecord>((route) => {
      const routeNameData = buildBusRouteNameData(route.campuses);
      return {
        id: route.id,
        nameCn: routeNameData.nameCn,
        nameEn: routeNameData.nameEn,
        stops: route.campuses.map((campus, index) => ({
          stopOrder: index,
          campus: campusById.get(campus.id) ?? toCampusSummary(locale, campus),
        })),
      };
    })
    .sort((left, right) => left.id - right.id);

  return { campuses, routes };
}

export async function getBusVersionTopology(
  locale: AppLocale,
  versionId: number,
): Promise<BusVersionTopology | null> {
  const version = await prisma.busScheduleVersion.findUnique({
    where: { id: versionId },
    select: { rawJson: true },
  });
  if (!version) return null;

  return buildBusVersionTopology(locale, version.rawJson as BusStaticPayload);
}
