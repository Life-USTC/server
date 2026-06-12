import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveBusDayType } from "./bus-departures";
import { buildBusMapActiveTrips } from "./bus-map-active-trips";
import {
  buildBusRouteEdges,
  buildBusRouteTripCounts,
} from "./bus-map-route-edges";
import { getBusCampuses, getRouteRecords } from "./bus-route-builder";
import type { BusMapCampusNode, BusMapData } from "./bus-types";
import { findEffectiveBusVersion } from "./bus-version";

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

  const tripCounts = buildBusRouteTripCounts(allTrips);

  const campusNodes: BusMapCampusNode[] = campuses.map((c) => ({
    id: c.id,
    namePrimary: c.namePrimary,
    nameSecondary: c.nameSecondary,
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  const routeEdges = buildBusRouteEdges({
    locale,
    records,
    tripCounts,
  });

  const nowMinutes = now.hour() * 60 + now.minute();
  const activeTrips = buildBusMapActiveTrips({
    nowMinutes,
    todayType,
    trips: allTrips,
  });

  return {
    campuses: campusNodes,
    routes: routeEdges,
    activeTrips,
    todayType,
    now: now.toISOString(),
  };
}
