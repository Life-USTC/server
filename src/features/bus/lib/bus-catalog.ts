import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  getBusCampuses,
  getRouteRecords,
  getVersionRouteIds,
} from "./bus-route-builder";
import { toRouteListing } from "./bus-route-listing";
import { busTripsToSlots } from "./bus-route-slots";
import type {
  BusCampusSummary,
  BusRouteListing,
  BusRouteTimetable,
} from "./bus-types";
import { findEffectiveBusVersion } from "./bus-version";

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
    where: { versionId: version.id, routeId: input.routeId },
    orderBy: [{ dayType: "asc" }, { position: "asc" }],
  });

  const weekdayTrips = routeTrips.filter((trip) => trip.dayType === "weekday");
  const weekendTrips = routeTrips.filter((trip) => trip.dayType === "weekend");

  const firstCampusId = record.stops[0]?.campus.id;
  const lastCampusId = record.stops[record.stops.length - 1]?.campus.id;
  const alternateRoutes = records
    .filter((r) => {
      if (r.id === input.routeId || r.stops.length < 2) return false;
      return (
        r.stops[0]?.campus.id === firstCampusId &&
        r.stops[r.stops.length - 1]?.campus.id === lastCampusId
      );
    })
    .map((r) => toRouteListing(locale, r))
    .filter((r): r is BusRouteListing => r != null);

  return {
    route: listing,
    weekday: busTripsToSlots(weekdayTrips),
    weekend: busTripsToSlots(weekendTrips),
    alternateRoutes,
  };
}
