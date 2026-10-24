import { describe, expect, test } from "vitest";
import { getApplicableBusRoutes } from "@/features/bus/lib/bus-client";
import { filterBusTableRoutes } from "@/features/bus/lib/bus-table-filters";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";
import type { BusTripSummary } from "@/features/bus/lib/bus-types";

function routes() {
  const campuses = [1, 2, 3].map((id) => ({
    id,
    nameCn: `Stop ${id}`,
    nameEn: null,
    namePrimary: `Stop ${id}`,
    nameSecondary: null,
    latitude: 0,
    longitude: 0,
  }));
  const routes = [
    [1, 3, 2],
    [1, 2],
  ].map((stops, id) => ({
    id: id + 1,
    nameCn: `Route ${id + 1}`,
    nameEn: null,
    descriptionPrimary: `Route ${id + 1}`,
    descriptionSecondary: null,
    stops: stops.map((campusId, stopOrder) => ({
      stopOrder,
      campus: campuses[campusId - 1],
    })),
  }));
  const trips: BusTripSummary[] = [
    [1, ["08:00", "08:10", "08:20"]],
    [1, ["09:00", null, "09:20"]],
    [1, [null, null, "10:20"]],
    [2, ["08:30", "08:50"]],
  ].map(([routeId, times], index) => {
    const route = routes[Number(routeId) - 1];
    const clocks = times as (string | null)[];
    const stopTimes = clocks.map((time, stopOrder) => ({
      stopOrder,
      campusId: route.stops[stopOrder].campus.id,
      campusName: route.stops[stopOrder].campus.nameCn,
      time,
      minutesSinceMidnight: time ? parseBusTimeMinutes(time) : null,
      isPassThrough: time === null,
    }));
    return {
      id: index + 1,
      routeId: Number(routeId),
      dayType: "weekday",
      position: index,
      stopTimes,
      departureTime: clocks[0],
      departureMinutes: stopTimes[0].minutesSinceMidnight,
      arrivalTime: clocks.at(-1) ?? null,
      arrivalMinutes: stopTimes.at(-1)?.minutesSinceMidnight ?? null,
    };
  });
  return getApplicableBusRoutes({
    data: { routes, trips },
    dayType: "weekday",
    startCampusId: 1,
    endCampusId: 2,
    showDepartedTrips: true,
    now: new Date("2026-10-23T00:15:00Z"),
  });
}

describe("bus table filters", () => {
  test("combines multi-select route choices and station presence over the whole timetable", () => {
    const data = routes();
    expect(
      filterBusTableRoutes(data, { routeId: "1,2", stop3: "no" }).map(
        (route) => route.route.id,
      ),
    ).toEqual([2]);
    expect(
      filterBusTableRoutes(data, { routeId: "1,2", stop3: "yes,no" }).map(
        (route) => route.route.id,
      ),
    ).toEqual([2, 1]);
    expect(
      filterBusTableRoutes(data, {
        stop3: "yes",
        time3: "09:10",
      })[0].visibleTrips.map((trip) => trip.trip.id),
    ).toEqual([2]);
    expect(
      filterBusTableRoutes(data, { time3: "09:10" })[0].nextTrip?.trip.id,
    ).toBe(2);
    expect(data[1].allTrips).toHaveLength(3);
  });

  test("compares displayed times including estimates and excludes unknown times", () => {
    const data = routes();
    for (const [operator, expected] of [
      ["eq", [2]],
      ["ne", [1]],
      ["gt", []],
      ["gte", [2]],
      ["lt", [1]],
      ["lte", [1, 2]],
      ["between", [2]],
    ] as const) {
      const filtered = filterBusTableRoutes(data, {
        time3: "09:10",
        time3Op: operator,
        time3Max: "10:00",
      });
      expect(
        filtered.flatMap((route) => route.allTrips.map((trip) => trip.trip.id)),
        operator,
      ).toEqual(expected);
    }
    expect(
      filterBusTableRoutes(data, {
        time3: "09:11",
        time3Op: "between",
        time3Max: "09:00",
      }),
    ).toEqual([]);
  });
});
