import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveBusDayType } from "../lib/bus-departures";
import { buildBusMapActiveTrips } from "../lib/bus-map-active-trips";
import {
  buildBusRouteEdges,
  buildBusRouteTripCounts,
} from "../lib/bus-map-route-edges";
import type { BusMapCampusNode, BusMapData } from "../lib/bus-types";
import { getStaticBusTimetableData } from "./bus-timetable-data";

export async function getBusMapData(input: {
  locale: AppLocale;
  now?: string;
  versionKey?: string | null;
}): Promise<BusMapData | null> {
  const locale = input.locale;
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const todayType = resolveBusDayType(undefined, now);
  const timetable = await getStaticBusTimetableData({
    locale,
    now: now.toISOString(),
    versionKey: input.versionKey,
  });
  if (!timetable) return null;

  const tripCounts = buildBusRouteTripCounts(timetable.trips);

  const campusNodes: BusMapCampusNode[] = timetable.campuses.map((c) => ({
    id: c.id,
    namePrimary: c.namePrimary,
    nameSecondary: c.nameSecondary,
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  const routeEdges = buildBusRouteEdges({
    locale,
    records: timetable.routes,
    tripCounts,
  });

  const nowMinutes = now.hour() * 60 + now.minute();
  const activeTrips = buildBusMapActiveTrips({
    nowMinutes,
    todayType,
    trips: timetable.trips.map((trip) => ({
      ...trip,
      stopTimes: trip.stopTimes.map((stop) => stop.time),
    })),
  });

  return {
    campuses: campusNodes,
    routes: routeEdges,
    activeTrips,
    todayType,
    now: now.toISOString(),
  };
}
