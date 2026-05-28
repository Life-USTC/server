import type {
  BusApplicableRoute,
  BusApplicableTrip,
  BusComputedStopTime,
} from "@/features/bus/lib/bus-client";

export const AUTO_SAVE_DELAY_MS = 600;

export const BUS_ROUTE_TABLE_SHELL_CLASS =
  "min-w-0 overflow-hidden bg-transparent";

export type BusTranslator = (
  key: string,
  values?: Record<string, number | string>,
) => string;

export function formatEtaHoursMinutes(
  minutes: number | null,
  t: BusTranslator,
): string | null {
  if (minutes == null) return null;
  if (minutes <= 0) return t("planner.departEtaMinutes", { count: 0 });

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return t("planner.departEtaMinutes", { count: rest });
  }
  if (rest === 0) {
    return t("planner.departEtaHours", { count: hours });
  }
  return t("planner.departEtaHoursMinutes", { hours, minutes: rest });
}

export function formatStopTime(stopTime: BusComputedStopTime): string {
  if (!stopTime.displayTime) return "—";
  return stopTime.isEstimated
    ? `~${stopTime.displayTime}`
    : stopTime.displayTime;
}

export function getRouteSegmentStopColumns(route: BusApplicableRoute): {
  label: string;
  stopOrder: number;
}[] {
  const stops = route.route.stops;
  const startIdx = stops.findIndex(
    (s) => s.stopOrder === route.startStop.stopOrder,
  );
  const endIdx = stops.findIndex(
    (s) => s.stopOrder === route.endStop.stopOrder,
  );
  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return [];

  const columns: { label: string; stopOrder: number }[] = [];
  for (let i = startIdx; i <= endIdx; i += 1) {
    columns.push({
      label: stops[i].campus.namePrimary,
      stopOrder: stops[i].stopOrder,
    });
  }
  return columns;
}

export function getTripStopTimeForOrder(
  trip: BusApplicableTrip,
  stopOrder: number,
): BusComputedStopTime {
  return (
    trip.stopTimes.find((st) => st.stopOrder === stopOrder) ?? trip.startTime
  );
}

export function getNextUpcomingTripHighlightKey(
  routes: BusApplicableRoute[],
): string | null {
  let bestMinutes = Number.POSITIVE_INFINITY;
  let bestKey: string | null = null;
  for (const route of routes) {
    for (const trip of route.visibleTrips) {
      if (trip.status !== "upcoming") continue;
      const minutes = trip.startTime.displayMinutes;
      if (minutes == null) continue;
      if (minutes < bestMinutes) {
        bestMinutes = minutes;
        bestKey = `${route.route.id}:${trip.trip.id}`;
      }
    }
  }
  return bestKey;
}
