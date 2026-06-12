import type {
  BusRouteSummary,
  BusTimetableData,
  BusUserPreferenceSummary,
} from "./bus-types";

type BusSelectionData = Pick<BusTimetableData, "campuses" | "routes">;

function hasRouteBetweenStops(
  route: BusRouteSummary,
  startCampusId: number | null,
  endCampusId: number | null,
) {
  if (
    startCampusId == null ||
    endCampusId == null ||
    startCampusId === endCampusId
  ) {
    return false;
  }

  const startStop = route.stops.find(
    (stop) => stop.campus.id === startCampusId,
  );
  const endStop = route.stops.find((stop) => stop.campus.id === endCampusId);

  return Boolean(
    startStop && endStop && startStop.stopOrder < endStop.stopOrder,
  );
}

export function getDefaultBusSelection(
  data: BusSelectionData,
  preference: BusUserPreferenceSummary | null,
): {
  startCampusId: number | null;
  endCampusId: number | null;
} {
  if (
    preference?.preferredOriginCampusId != null &&
    preference?.preferredDestinationCampusId != null &&
    data.routes.some((route) =>
      hasRouteBetweenStops(
        route,
        preference.preferredOriginCampusId,
        preference.preferredDestinationCampusId,
      ),
    )
  ) {
    return {
      startCampusId: preference.preferredOriginCampusId,
      endCampusId: preference.preferredDestinationCampusId,
    };
  }

  const firstUsableRoute = data.routes.find((route) => route.stops.length >= 2);
  if (firstUsableRoute) {
    return {
      startCampusId: firstUsableRoute.stops[0]?.campus.id ?? null,
      endCampusId:
        firstUsableRoute.stops[firstUsableRoute.stops.length - 1]?.campus.id ??
        null,
    };
  }

  return {
    startCampusId: data.campuses[0]?.id ?? null,
    endCampusId: data.campuses[1]?.id ?? null,
  };
}
