import type { BusApplicableRoute } from "./bus-applicable-routes";
import type { BusCampusSummary } from "./bus-types";

function compareDepartureMinutes(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
) {
  const lm = left ?? Number.MAX_SAFE_INTEGER;
  const rm = right ?? Number.MAX_SAFE_INTEGER;
  if (lm === rm) return 0;
  return direction === "asc" ? lm - rm : rm - lm;
}

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
      if (left.status !== right.status) {
        return left.status === "upcoming" ? -1 : 1;
      }
      const timeOrder = compareDepartureMinutes(
        left.minutesUntilDeparture,
        right.minutesUntilDeparture,
        left.status === "upcoming" ? "asc" : "desc",
      );
      return timeOrder !== 0 ? timeOrder : left.routeId - right.routeId;
    })
    .slice(0, limit);
}
