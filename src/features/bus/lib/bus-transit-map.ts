import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveBusDayType } from "./bus-departures";
import {
  describeRoute,
  getBusCampuses,
  getRouteRecords,
} from "./bus-route-builder";
import { parseBusTimeMinutes } from "./bus-time";
import type {
  BusMapActiveTrip,
  BusMapCampusNode,
  BusMapData,
  BusMapRouteEdge,
} from "./bus-types";
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

  const nowMinutes = now.hour() * 60 + now.minute();
  const activeTrips: BusMapActiveTrip[] = [];

  for (const trip of allTrips.filter((item) => item.dayType === todayType)) {
    const stopTimes = trip.stopTimes as Array<string | null>;
    const parsedTimes = stopTimes.map((t) => parseBusTimeMinutes(t));
    const firstTime = parsedTimes.find((t) => t != null);
    const lastTime = [...parsedTimes].reverse().find((t) => t != null);
    if (firstTime == null || lastTime == null) continue;

    if (nowMinutes >= firstTime && nowMinutes <= lastTime) {
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
    } else if (firstTime > nowMinutes && firstTime <= nowMinutes + 60) {
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
