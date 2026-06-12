import type { BusApplicableRoute } from "./bus-applicable-routes";
import type { BusCampusSummary } from "./bus-types";

export function buildVisibleBusDepartures({
  applicableRoutes,
  destinationCampus,
  limit,
  originCampus,
}: {
  applicableRoutes: BusApplicableRoute[];
  destinationCampus: BusCampusSummary | null;
  limit: number;
  originCampus: BusCampusSummary | null;
}) {
  return applicableRoutes
    .flatMap((route) =>
      route.visibleTrips.map((trip) => ({
        tripId: trip.trip.id,
        routeId: route.route.id,
        route: {
          id: route.route.id,
          nameCn: route.route.nameCn,
          nameEn: route.route.nameEn,
          descriptionPrimary: route.route.descriptionPrimary,
          descriptionSecondary: route.route.descriptionSecondary,
        },
        originCampus,
        destinationCampus,
        departureTime: trip.startTime.displayTime,
        arrivalTime: trip.endTime.displayTime,
        departureEstimated: trip.startTime.isEstimated,
        arrivalEstimated: trip.endTime.isEstimated,
        minutesUntilDeparture: trip.minutesUntilDeparture,
        dayType: trip.trip.dayType,
        status: trip.status,
      })),
    )
    .sort((left, right) => {
      const lm = left.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      const rm = right.minutesUntilDeparture ?? Number.MAX_SAFE_INTEGER;
      return lm !== rm ? lm - rm : left.routeId - right.routeId;
    })
    .slice(0, limit);
}
