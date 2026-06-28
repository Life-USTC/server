import { describe, expect, it } from "vitest";
import { buildNextBusDeparturesFromData } from "@/features/bus/lib/bus-departures";
import { parseBusTimeMinutes } from "@/features/bus/lib/bus-time";
import type {
  BusCampusSummary,
  BusTimetableData,
  BusTripSummary,
} from "@/features/bus/lib/bus-types";

const east: BusCampusSummary = {
  id: 1,
  nameCn: "东区",
  nameEn: "East",
  namePrimary: "东区",
  nameSecondary: "East",
  latitude: 0,
  longitude: 0,
};

const west: BusCampusSummary = {
  id: 2,
  nameCn: "西区",
  nameEn: "West",
  namePrimary: "西区",
  nameSecondary: "West",
  latitude: 0,
  longitude: 0,
};

function createTrip(id: number, departureTime: string): BusTripSummary {
  const departureMinutes = parseBusTimeMinutes(departureTime);
  const arrivalMinutes =
    departureMinutes == null ? null : departureMinutes + 20;
  const arrivalTime =
    arrivalMinutes == null
      ? null
      : `${String(Math.floor(arrivalMinutes / 60)).padStart(2, "0")}:${String(
          arrivalMinutes % 60,
        ).padStart(2, "0")}`;

  return {
    id,
    routeId: 8,
    dayType: "weekday",
    position: id,
    stopTimes: [
      {
        stopOrder: 1,
        campusId: east.id,
        campusName: east.namePrimary,
        time: departureTime,
        minutesSinceMidnight: departureMinutes,
        isPassThrough: false,
      },
      {
        stopOrder: 2,
        campusId: west.id,
        campusName: west.namePrimary,
        time: arrivalTime,
        minutesSinceMidnight: arrivalMinutes,
        isPassThrough: false,
      },
    ],
    departureTime,
    departureMinutes,
    arrivalTime,
    arrivalMinutes,
  };
}

function createNextDepartureData(): BusTimetableData {
  return {
    locale: "zh-cn",
    fetchedAt: "2026-04-22T01:30:00.000Z",
    version: null,
    availableVersions: [],
    campuses: [east, west],
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
    ],
    trips: [
      createTrip(1, "08:00"),
      createTrip(2, "09:00"),
      createTrip(3, "10:00"),
    ],
    preferences: null,
    notice: null,
  };
}

describe("班车服务", () => {
  it("精确解析 HH:mm 时刻表值", () => {
    expect(parseBusTimeMinutes("08:05")).toBe(8 * 60 + 5);
    expect(parseBusTimeMinutes("8:05")).toBe(8 * 60 + 5);
    expect(parseBusTimeMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("拒绝格式错误或越界的时刻表值", () => {
    expect(parseBusTimeMinutes(null)).toBeNull();
    expect(parseBusTimeMinutes("08:05x")).toBeNull();
    expect(parseBusTimeMinutes("08:5")).toBeNull();
    expect(parseBusTimeMinutes("24:00")).toBeNull();
    expect(parseBusTimeMinutes("08:60")).toBeNull();
  });

  it("将即将出发的班次排在已出发班次之前", () => {
    const result = buildNextBusDeparturesFromData(createNextDepartureData(), {
      originCampusId: east.id,
      destinationCampusId: west.id,
      atTime: "2026-04-22T01:30:00.000Z",
      dayType: "weekday",
      includeDeparted: true,
      limit: 1,
    });

    expect(result.departures).toHaveLength(1);
    expect(result.departures[0]?.departureTime).toBe("10:00");
    expect(result.departures[0]?.status).toBe("upcoming");
    expect(result.departures[0]?.minutesUntilDeparture).toBe(30);
  });
});
