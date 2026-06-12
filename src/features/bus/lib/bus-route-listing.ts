import type { AppLocale } from "@/i18n/config";
import { describeRoute } from "./bus-route-descriptions";
import type { RouteRecord } from "./bus-route-records";
import type { BusRouteListing } from "./bus-types";

export function toRouteListing(
  locale: AppLocale,
  route: RouteRecord,
): BusRouteListing | null {
  if (route.stops.length < 2) return null;
  const desc = describeRoute(locale, route.stops);
  return {
    id: route.id,
    nameCn: route.nameCn,
    nameEn: route.nameEn,
    descriptionPrimary: desc.descriptionPrimary,
    stops: route.stops.map((s) => ({
      stopOrder: s.stopOrder,
      campusId: s.campus.id,
      campusName: s.campus.namePrimary,
    })),
  };
}
