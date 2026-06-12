import type { AppLocale } from "@/i18n/config";
import type { RouteRecord } from "./bus-route-records";
import type { BusRouteStopSummary, BusRouteSummary } from "./bus-types";

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
