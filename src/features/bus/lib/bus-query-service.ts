import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { buildNextBusDeparturesFromData } from "./bus-departures";
import { searchBusRoutesFromData } from "./bus-route-search";
import { getBusTimetableData } from "./bus-timetable-data";
import type { BusNextDeparturesResult, BusResolvedDayType } from "./bus-types";

export async function getNextBusDepartures(input: {
  locale: AppLocale;
  originCampusId: number;
  destinationCampusId: number;
  atTime?: string;
  dayType?: BusResolvedDayType;
  limit?: number;
  includeDeparted?: boolean;
  versionKey?: string | null;
  userId?: string | null;
}): Promise<BusNextDeparturesResult | null> {
  const now = input.atTime ? shanghaiDayjs(input.atTime) : shanghaiDayjs();
  const data = await getBusTimetableData({
    locale: input.locale,
    now: now.toISOString(),
    versionKey: input.versionKey,
    userId: input.userId,
  });
  if (!data) return null;

  return buildNextBusDeparturesFromData(data, {
    originCampusId: input.originCampusId,
    destinationCampusId: input.destinationCampusId,
    atTime: now.toISOString(),
    dayType: input.dayType,
    limit: input.limit,
    includeDeparted: input.includeDeparted,
  });
}

export async function searchBusRoutes(input: {
  locale: AppLocale;
  originCampusId?: number;
  destinationCampusId?: number;
  versionKey?: string | null;
}) {
  const data = await getBusTimetableData({
    locale: input.locale,
    versionKey: input.versionKey,
  });
  if (!data) return null;

  return searchBusRoutesFromData(data, input);
}
