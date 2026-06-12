import type { AppLocale } from "@/i18n/config";
import { describeRoute } from "./bus-route-builder";
import type { RouteRecord } from "./bus-route-records";
import type { BusMapRouteEdge } from "./bus-types";

export function buildBusRouteTripCounts(
  trips: Array<{ routeId: number; dayType: "weekday" | "weekend" }>,
) {
  const tripCounts = new Map<number, { weekday: number; weekend: number }>();
  for (const trip of trips) {
    const count = tripCounts.get(trip.routeId) ?? { weekday: 0, weekend: 0 };
    count[trip.dayType] += 1;
    tripCounts.set(trip.routeId, count);
  }
  return tripCounts;
}

export function buildBusRouteEdges({
  locale,
  records,
  tripCounts,
}: {
  locale: AppLocale;
  records: RouteRecord[];
  tripCounts: Map<number, { weekday: number; weekend: number }>;
}): BusMapRouteEdge[] {
  return records
    .filter((record) => record.stops.length >= 2)
    .map((record) => {
      const desc = describeRoute(locale, record.stops);
      return {
        routeId: record.id,
        descriptionPrimary: desc.descriptionPrimary,
        stops: record.stops.map((stop) => ({
          campusId: stop.campus.id,
          campusName: stop.campus.namePrimary,
        })),
        weekdayTrips: tripCounts.get(record.id)?.weekday ?? 0,
        weekendTrips: tripCounts.get(record.id)?.weekend ?? 0,
      };
    });
}
