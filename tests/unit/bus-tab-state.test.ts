import { describe, expect, test } from "vitest";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";
import type { BusTripSummary } from "@/features/bus/lib/bus-types";
import { createBusTabState } from "@/features/dashboard/lib/bus-tab-state";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";

function createTrip(input: {
  id: number;
  routeId: number;
  dayType: "weekday" | "weekend";
  position: number;
  times: Array<
    [stopOrder: number, campusId: number, campusName: string, time: string]
  >;
}): BusTripSummary {
  const stopTimes = input.times.map(
    ([stopOrder, campusId, campusName, time]) => ({
      campusId,
      campusName,
      isPassThrough: false,
      minutesSinceMidnight: parseBusTimeMinutes(time) ?? 0,
      stopOrder,
      time,
    }),
  );

  return {
    arrivalMinutes:
      stopTimes[stopTimes.length - 1]?.minutesSinceMidnight ?? null,
    arrivalTime: stopTimes[stopTimes.length - 1]?.time ?? null,
    dayType: input.dayType,
    departureMinutes: stopTimes[0]?.minutesSinceMidnight ?? null,
    departureTime: stopTimes[0]?.time ?? null,
    id: input.id,
    position: input.position,
    routeId: input.routeId,
    stopTimes,
  };
}

function createBusData(): DashboardBusData {
  const east = {
    id: 1,
    latitude: 0,
    longitude: 0,
    nameCn: "东区",
    nameEn: "East",
    namePrimary: "东区",
    nameSecondary: "East",
  };
  const west = {
    id: 2,
    latitude: 0,
    longitude: 0,
    nameCn: "西区",
    nameEn: "West",
    namePrimary: "西区",
    nameSecondary: "West",
  };

  return {
    campuses: [east, west],
    fetchedAt: "2026-04-24T16:30:00.000Z",
    notice: null,
    preferences: null,
    routes: [
      {
        descriptionPrimary: "东区 -> 西区",
        descriptionSecondary: null,
        id: 8,
        nameCn: "东区 -> 西区",
        nameEn: null,
        stops: [
          { campus: east, stopOrder: 1 },
          { campus: west, stopOrder: 2 },
        ],
      },
    ],
    trips: [
      createTrip({
        dayType: "weekend",
        id: 801,
        position: 1,
        routeId: 8,
        times: [
          [1, 1, "东区", "00:45"],
          [2, 2, "西区", "01:05"],
        ],
      }),
    ],
    version: null,
  };
}

describe("班车标签页状态", () => {
  test("根据 fetchedAt 初始化规划器时间和日期类型", () => {
    const bus = createBusData();
    const state = createBusTabState({
      getBus: () => bus,
      getBusCopy: () => ({}) as DashboardBusCopy,
      getSavePreferences: () => false,
      invalidate: () => {},
    });

    state.initializeWhenNeeded();

    expect(state.values.busNow.toISOString()).toBe(bus.fetchedAt);
    expect(state.values.busDayType).toBe("weekend");
    expect(state.values.busStartCampusId).toBe(1);
    expect(state.values.busEndCampusId).toBe(2);
    expect(state.applicableRoutes()[0]?.nextTrip?.minutesUntilStart).toBe(15);
  });
});
