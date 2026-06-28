import { describe, expect, test } from "vitest";
import {
  getApplicableBusRoutes,
  getShanghaiMinutesSinceMidnight,
  resolveClientBusDayType,
} from "@/features/bus/lib/bus-client";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";
import type {
  BusTimetableData,
  BusTripSummary,
} from "@/features/bus/lib/bus-types";

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
    ([stopOrder, campusId, campusName, time]) => {
      return {
        stopOrder,
        campusId,
        campusName,
        time,
        minutesSinceMidnight: parseBusTimeMinutes(time) ?? 0,
        isPassThrough: false,
      };
    },
  );

  return {
    id: input.id,
    routeId: input.routeId,
    dayType: input.dayType,
    position: input.position,
    stopTimes,
    departureTime: stopTimes[0]?.time ?? null,
    departureMinutes: stopTimes[0]?.minutesSinceMidnight ?? null,
    arrivalTime: stopTimes[stopTimes.length - 1]?.time ?? null,
    arrivalMinutes:
      stopTimes[stopTimes.length - 1]?.minutesSinceMidnight ?? null,
  };
}

function createBusData(): BusTimetableData {
  const east = {
    id: 1,
    nameCn: "东区",
    nameEn: "East",
    namePrimary: "东区",
    nameSecondary: "East",
    latitude: 0,
    longitude: 0,
  };
  const west = {
    id: 2,
    nameCn: "西区",
    nameEn: "West",
    namePrimary: "西区",
    nameSecondary: "West",
    latitude: 0,
    longitude: 0,
  };
  const north = {
    id: 3,
    nameCn: "北区",
    nameEn: "North",
    namePrimary: "北区",
    nameSecondary: "North",
    latitude: 0,
    longitude: 0,
  };

  return {
    locale: "zh-cn",
    fetchedAt: "2026-04-22T13:10:00.000Z",
    version: null,
    availableVersions: [],
    campuses: [east, west, north],
    routes: [
      {
        id: 8,
        nameCn: "东区 -> 西区",
        nameEn: null,
        descriptionPrimary: "东区 -> 西区",
        descriptionSecondary: null,
        stops: [
          { stopOrder: 1, campus: east },
          { stopOrder: 2, campus: west },
        ],
      },
      {
        id: 9,
        nameCn: "东区 -> 北区 -> 西区",
        nameEn: null,
        descriptionPrimary: "东区 -> 北区 -> 西区",
        descriptionSecondary: null,
        stops: [
          { stopOrder: 1, campus: east },
          { stopOrder: 2, campus: north },
          { stopOrder: 3, campus: west },
        ],
      },
    ],
    trips: [
      createTrip({
        id: 801,
        routeId: 8,
        dayType: "weekday",
        position: 1,
        times: [
          [1, 1, "东区", "21:20"],
          [2, 2, "西区", "21:40"],
        ],
      }),
      createTrip({
        id: 901,
        routeId: 9,
        dayType: "weekday",
        position: 1,
        times: [
          [1, 1, "东区", "21:40"],
          [2, 3, "北区", "21:50"],
          [3, 2, "西区", "22:00"],
        ],
      }),
    ],
    preferences: null,
    notice: null,
  };
}

describe("班车客户端时刻表计算", () => {
  test("将绝对时刻转换为上海本地午夜以来的分钟数", () => {
    expect(
      getShanghaiMinutesSinceMidnight(new Date("2026-04-22T13:10:00.000Z")),
    ).toBe(21 * 60 + 10);
  });

  test("根据上海日历日期解析日期类型", () => {
    expect(resolveClientBusDayType(new Date("2026-04-24T15:59:00.000Z"))).toBe(
      "weekday",
    );
    expect(resolveClientBusDayType(new Date("2026-04-24T16:00:00.000Z"))).toBe(
      "weekend",
    );
    expect(resolveClientBusDayType(new Date("2026-04-26T16:00:00.000Z"))).toBe(
      "weekday",
    );
  });

  test("按下一班上海发车时间排序路线", () => {
    const routes = getApplicableBusRoutes({
      data: createBusData(),
      dayType: "weekday",
      startCampusId: 1,
      endCampusId: 2,
      showDepartedTrips: false,
      now: new Date("2026-04-22T13:10:00.000Z"),
    });

    expect(routes.map((route) => route.route.id)).toEqual([8, 9]);
    expect(routes[0]?.nextTrip?.minutesUntilStart).toBe(10);
    expect(routes[0]?.nextTrip?.status).toBe("upcoming");
  });

  test("当上海本地时间超过站点时间后将行程标记为已发车", () => {
    const routes = getApplicableBusRoutes({
      data: createBusData(),
      dayType: "weekday",
      startCampusId: 1,
      endCampusId: 2,
      showDepartedTrips: true,
      now: new Date("2026-04-22T13:30:00.000Z"),
    });

    expect(routes[0]?.route.id).toBe(9);
    expect(routes[0]?.nextTrip?.trip.id).toBe(901);
    expect(routes[1]?.allTrips[0]?.trip.id).toBe(801);
    expect(routes[1]?.allTrips[0]?.status).toBe("departed");
    expect(routes[1]?.allTrips[0]?.minutesUntilStart).toBe(-10);
  });
});
