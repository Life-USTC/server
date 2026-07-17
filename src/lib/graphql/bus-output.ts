import type {
  BusCampusSummary,
  BusRouteListing,
  BusTripSlot,
} from "@/features/bus/lib/bus-types";
import { GRAPHQL_LIMITS } from "./constants";

export function capGraphqlBusRoute(route: BusRouteListing): BusRouteListing {
  return {
    ...route,
    stops: route.stops.slice(0, GRAPHQL_LIMITS.busRouteStops),
  };
}

export function capGraphqlBusCampuses(campuses: BusCampusSummary[]) {
  return campuses.slice(0, GRAPHQL_LIMITS.busCampuses);
}

export function capGraphqlBusTripSlots(slots: BusTripSlot[]) {
  return slots.map((slot) => ({
    ...slot,
    stopTimes: slot.stopTimes.slice(0, GRAPHQL_LIMITS.busStopTimes),
  }));
}

export function capGraphqlAlternateRoutes(routes: BusRouteListing[]) {
  return routes
    .slice(0, GRAPHQL_LIMITS.busAlternateRoutes)
    .map(capGraphqlBusRoute);
}
