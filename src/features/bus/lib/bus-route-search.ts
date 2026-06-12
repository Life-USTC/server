import type { BusTimetableData } from "./bus-types";

export function searchBusRoutesFromData(
  data: BusTimetableData,
  input: {
    originCampusId?: number;
    destinationCampusId?: number;
  },
) {
  const tripCounts = new Map<number, { weekday: number; weekend: number }>();
  for (const trip of data.trips) {
    const count = tripCounts.get(trip.routeId) ?? { weekday: 0, weekend: 0 };
    count[trip.dayType] += 1;
    tripCounts.set(trip.routeId, count);
  }

  const routes = data.routes
    .filter((route) => {
      const stopIds = route.stops.map((stop) => stop.campus.id);
      const hasOrigin =
        input.originCampusId == null || stopIds.includes(input.originCampusId);
      const hasDestination =
        input.destinationCampusId == null ||
        stopIds.includes(input.destinationCampusId);
      if (!hasOrigin || !hasDestination) return false;
      if (
        input.originCampusId != null &&
        input.destinationCampusId != null &&
        input.originCampusId !== input.destinationCampusId
      ) {
        const originIndex = route.stops.findIndex(
          (stop) => stop.campus.id === input.originCampusId,
        );
        const destinationIndex = route.stops.findIndex(
          (stop) => stop.campus.id === input.destinationCampusId,
        );
        return originIndex >= 0 && destinationIndex > originIndex;
      }
      return true;
    })
    .map((route) => ({
      id: route.id,
      nameCn: route.nameCn,
      nameEn: route.nameEn,
      descriptionPrimary: route.descriptionPrimary,
      descriptionSecondary: route.descriptionSecondary,
      originCampus: route.stops[0]?.campus ?? null,
      destinationCampus: route.stops[route.stops.length - 1]?.campus ?? null,
      stopCount: route.stops.length,
      weekdayTrips: tripCounts.get(route.id)?.weekday ?? 0,
      weekendTrips: tripCounts.get(route.id)?.weekend ?? 0,
      stops: route.stops,
    }))
    .sort((left, right) => left.id - right.id);

  return {
    originCampus:
      input.originCampusId != null
        ? (data.campuses.find((campus) => campus.id === input.originCampusId) ??
          null)
        : null,
    destinationCampus:
      input.destinationCampusId != null
        ? (data.campuses.find(
            (campus) => campus.id === input.destinationCampusId,
          ) ?? null)
        : null,
    total: routes.length,
    routes,
  };
}
