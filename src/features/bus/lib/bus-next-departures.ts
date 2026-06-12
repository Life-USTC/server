import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { buildApplicableBusRoutes } from "./bus-applicable-routes";
import { resolveBusDayType } from "./bus-day-type";
import {
  buildNoBusDepartureMessage,
  findNextAvailableBusDeparture,
} from "./bus-next-departure-guidance";
import type {
  BusNextDeparturesResult,
  BusResolvedDayType,
  BusTimetableData,
} from "./bus-types";
import { buildVisibleBusDepartures } from "./bus-visible-departures";

export function buildNextBusDeparturesFromData(
  data: BusTimetableData,
  input: {
    originCampusId: number;
    destinationCampusId: number;
    atTime?: string;
    dayType?: BusResolvedDayType;
    limit?: number;
    includeDeparted?: boolean;
    includeNextAvailableGuidance?: boolean;
  },
): BusNextDeparturesResult {
  const now = input.atTime ? shanghaiDayjs(input.atTime) : shanghaiDayjs();
  const dayType = resolveBusDayType(input.dayType, now);
  const originCampus =
    data.campuses.find((campus) => campus.id === input.originCampusId) ?? null;
  const destinationCampus =
    data.campuses.find((campus) => campus.id === input.destinationCampusId) ??
    null;

  const applicableRoutes = buildApplicableBusRoutes({
    data,
    dayType,
    originCampusId: input.originCampusId,
    destinationCampusId: input.destinationCampusId,
    showDepartedTrips: input.includeDeparted ?? false,
    now: now.toDate(),
  });

  const departures = buildVisibleBusDepartures({
    applicableRoutes,
    destinationCampus,
    limit: input.limit ?? 5,
    originCampus,
  });

  let nextAvailableDeparture: (typeof departures)[number] | null = null;
  if (
    input.includeNextAvailableGuidance !== false &&
    departures.length === 0 &&
    applicableRoutes.length > 0
  ) {
    nextAvailableDeparture = findNextAvailableBusDeparture({
      buildSnapshot: buildNextBusDeparturesFromData,
      data,
      destinationCampusId: input.destinationCampusId,
      now,
      originCampusId: input.originCampusId,
    });
  }

  const message = buildNoBusDepartureMessage({
    applicableRouteCount: applicableRoutes.length,
    dayType,
    departureCount: departures.length,
    nextAvailableDeparture,
  });

  return {
    originCampus,
    destinationCampus,
    atTime: now.toISOString(),
    dayType,
    totalRoutes: applicableRoutes.length,
    departures,
    nextAvailableDeparture,
    message,
  };
}
