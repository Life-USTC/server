import type { WorkspaceBusCopy } from "@/features/workspace/lib/bus-tab-types";
import { matchTableFilter, type TableFilterField } from "@/lib/table-filters";
import type { BusApplicableRoute, BusApplicableTrip } from "./bus-client-types";

export function busStopFilterFields(
  campusId: number,
  name: string,
  copy: WorkspaceBusCopy,
): TableFilterField[] {
  return [
    {
      name: `stop${campusId}`,
      label: `${name} · ${copy.passThrough}`,
      options: [
        { value: "yes", label: copy.tableFilters.yes },
        { value: "no", label: copy.tableFilters.no },
      ],
    },
    {
      name: `time${campusId}`,
      label: `${name} · ${copy.arriveAt}`,
      type: "time",
    },
  ];
}

/** A station filter refers to the selected route segment, not an unrelated stop beyond the destination. */
export function filterBusTableRoutes(
  routes: BusApplicableRoute[],
  values: Record<string, string>,
) {
  const stopFilters = Object.keys(values).filter(
    (key) => /^(stop|time)\d+$/.test(key) && values[key],
  );
  return routes
    .flatMap((route) => {
      if (
        !matchTableFilter(
          route.route.id,
          { name: "routeId", label: "", options: [] },
          values,
        )
      )
        return [];
      const segmentStops = route.route.stops.filter(
        (stop) =>
          stop.stopOrder >= route.startStop.stopOrder &&
          stop.stopOrder <= route.endStop.stopOrder,
      );
      const matches = (trip: BusApplicableTrip) =>
        stopFilters.every((key) => {
          const isTime = key.startsWith("time");
          const campusId = Number(key.slice(4));
          const stop = segmentStops.find((item) => item.campus.id === campusId);
          if (!isTime)
            return matchTableFilter(
              stop ? "yes" : "no",
              { name: key, label: "", options: [] },
              values,
            );
          const time = stop
            ? trip.stopTimes.find((item) => item.stopOrder === stop.stopOrder)
                ?.displayTime
            : null;
          return matchTableFilter(
            time,
            { name: key, label: "", type: "time" },
            values,
          );
        });
      const allTrips = route.allTrips.filter(matches);
      if (stopFilters.length && !allTrips.length) return [];
      const upcomingTrips = route.upcomingTrips.filter(matches);
      return [
        {
          ...route,
          allTrips,
          upcomingTrips,
          visibleTrips: route.visibleTrips.filter(matches),
          nextTrip: upcomingTrips[0] ?? null,
          totalTrips: allTrips.length,
        },
      ];
    })
    .sort((left, right) => {
      const a =
        left.nextTrip?.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
      const b =
        right.nextTrip?.startTime.displayMinutes ?? Number.MAX_SAFE_INTEGER;
      return a - b || left.route.id - right.route.id;
    });
}
