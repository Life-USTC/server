import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getApplicableBusRoutes,
  getShanghaiMinutesSinceMidnight,
  resolveClientBusDayType,
} from "@/features/bus/lib/bus-client";
import { buildNextBusDeparturesFromData } from "@/features/bus/lib/bus-departures";
import { buildComputedStopTime } from "@/features/bus/lib/bus-stop-time-computation";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";
import type {
  BusTimetableData,
  BusTripSummary,
} from "@/features/bus/lib/bus-types";
import { nextBusDepartures } from "@/features/workspace/lib/bus";

function createTrip(input: {
  id: number;
  routeId: number;
  dayType: "weekday" | "saturday" | "sunday";
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
      "saturday",
    );
    expect(resolveClientBusDayType(new Date("2026-04-25T16:00:00.000Z"))).toBe(
      "sunday",
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
    expect(nextBusDepartures(routes).map(({ trip }) => trip.trip.id)).toEqual([
      801, 901,
    ]);
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

afterEach(() => vi.unstubAllEnvs());

test("bus.shanghai-time-interpretation", () => {
  for (const timezone of ["UTC", "Asia/Shanghai", "America/Los_Angeles"]) {
    vi.stubEnv("TZ", timezone);
    const now = new Date("2026-04-22T13:30:00Z");
    expect(getShanghaiMinutesSinceMidnight(now)).toBe(21 * 60 + 30);
    const routes = getApplicableBusRoutes({
      data: createBusData(),
      dayType: "weekday",
      startCampusId: 1,
      endCampusId: 2,
      showDepartedTrips: true,
      now,
    });
    expect(routes.map((route) => route.route.id)).toEqual([9, 8]);
    expect(routes[0]?.nextTrip?.minutesUntilStart).toBe(10);
    expect(routes[0]?.nextTrip?.status).toBe("upcoming");
    expect(routes[1]?.allTrips[0]?.status).toBe("departed");
    expect(routes[1]?.allTrips[0]?.minutesUntilStart).toBe(-10);
  }
});

test("bus.stop-time-estimate-bounds", () => {
  const stops = (times: (string | null)[]) =>
    times.map((time, index) => ({
      stopOrder: index + 1,
      campusId: index + 1,
      campusName: String(index + 1),
      time,
      minutesSinceMidnight: parseBusTimeMinutes(time),
      isPassThrough: time === null,
    }));
  expect(
    buildComputedStopTime(stops(["08:00", null, "08:20"]), 1),
  ).toMatchObject({
    displayTime: "08:10",
    displayMinutes: 490,
    isEstimated: true,
  });
  expect(
    buildComputedStopTime(stops(["08:00", null, "08:00"]), 1),
  ).toMatchObject({ displayTime: "08:00", isEstimated: true });
  expect(
    buildComputedStopTime(stops(["08:00", "08:05", "08:20"]), 1),
  ).toMatchObject({
    displayTime: "08:05",
    displayMinutes: 485,
    isEstimated: false,
  });
  for (const times of [
    ["23:50", null, "00:10"],
    ["08:00", null, null],
    [null, null, "08:20"],
    [null, null, null],
  ] as const) {
    const stopTimes = stops([...times]);
    expect(buildComputedStopTime(stopTimes, 1)).toMatchObject({
      displayTime: null,
      displayMinutes: null,
      isEstimated: false,
    });
    const data = createBusData();
    data.routes = [
      {
        ...data.routes[1],
        stops: data.routes[1].stops.map((stop, index) => ({
          ...stop,
          stopOrder: index + 1,
          campus: { ...stop.campus, id: index + 1 },
        })),
      },
    ];
    data.trips = [{ ...data.trips[1], stopTimes }];
    const result = getApplicableBusRoutes({
      data,
      dayType: "weekday",
      startCampusId: 2,
      endCampusId: 3,
      showDepartedTrips: true,
      now: new Date("2026-04-22T00:00:00Z"),
    });
    expect(result[0]?.nextTrip?.minutesUntilStart ?? null).toBeNull();
    expect(result[0]?.upcomingTrips ?? []).toEqual([]);
    expect(result[0]?.allTrips[0]?.status).toBeNull();
    const visibleUnknown = getApplicableBusRoutes({
      data,
      dayType: "weekday",
      startCampusId: 2,
      endCampusId: 3,
      showDepartedTrips: false,
      now: new Date("2026-04-22T00:00:00Z"),
    });
    expect(visibleUnknown[0]?.visibleTrips).toHaveLength(1);
    expect(visibleUnknown[0]?.visibleTrips[0]?.status).toBeNull();
    for (const includeDeparted of [false, true]) {
      const departures = buildNextBusDeparturesFromData(data, {
        originCampusId: 2,
        destinationCampusId: 3,
        dayType: "weekday",
        atTime: "2026-04-22T00:00:00Z",
        includeDeparted,
      });
      expect(departures.departures).toEqual([]);
      expect(departures.nextAvailableDeparture).toBeNull();
    }
  }
});
