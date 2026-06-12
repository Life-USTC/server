import {
  buildRoutePoints,
  computeOffsets,
  layoutCampuses,
  pointsToPath,
} from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapActiveTrip,
  BusMapData,
  BusMapDayTypeLabels,
} from "./bus-map-types";

export function buildBusMapViewState(
  mapData: BusMapData | null | undefined,
  dayTypeLabels: BusMapDayTypeLabels,
  locale: string,
) {
  const positions = mapData ? layoutCampuses(mapData.campuses) : new Map();
  const allRouteIds = mapData
    ? mapData.routes.map((route) => route.routeId)
    : [];
  const offsets = mapData ? computeOffsets(mapData.routes) : new Map();
  const routePaths = mapData
    ? new Map(
        mapData.routes.map((route) => {
          const points = buildRoutePoints(route, positions, offsets);
          return [
            route.routeId,
            { points, path: pointsToPath(points) },
          ] as const;
        }),
      )
    : new Map();
  const activeRouteIds = new Set(
    mapData?.activeTrips.map((trip) => trip.routeId) ?? [],
  );
  const enRouteTrips =
    mapData?.activeTrips.filter((trip) => trip.status === "en-route") ?? [];
  const departingSoonTrips =
    mapData?.activeTrips.filter((trip) => trip.status === "departing-soon") ??
    [];
  const nowDate = mapData ? new Date(mapData.now) : null;

  return {
    activeRouteIds,
    allRouteIds,
    dayTypeLabel: mapData ? dayTypeLabels[mapData.todayType] : "",
    departingSoonCount: departingSoonTrips.length,
    departingSoonTrips,
    departingTripsByCampus: groupDepartingTripsByCampus(
      mapData,
      departingSoonTrips,
    ),
    enRouteCount: enRouteTrips.length,
    enRouteTrips,
    nowMinutes: nowDate ? nowDate.getHours() * 60 + nowDate.getMinutes() : 0,
    offsets,
    positions,
    routePaths,
    totalTripsForToday: totalTripsForToday(mapData),
    updatedTime: nowDate
      ? nowDate.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
  };
}

function totalTripsForToday(mapData: BusMapData | null | undefined) {
  return (
    mapData?.routes.reduce(
      (total, route) =>
        total +
        (mapData.todayType === "weekday"
          ? route.weekdayTrips
          : route.weekendTrips),
      0,
    ) ?? 0
  );
}

function groupDepartingTripsByCampus(
  mapData: BusMapData | null | undefined,
  departingSoonTrips: BusMapActiveTrip[],
) {
  const grouped = new Map<number, BusMapActiveTrip[]>();
  if (!mapData) return grouped;
  for (const trip of departingSoonTrips) {
    const route = mapData.routes.find((item) => item.routeId === trip.routeId);
    const campusId = route?.stops[0]?.campusId;
    if (campusId == null) continue;
    const list = grouped.get(campusId) ?? [];
    list.push(trip);
    grouped.set(campusId, list);
  }
  return grouped;
}
