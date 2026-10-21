import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BusCampusSummary,
  BusTimetableData,
  BusTripSummary,
} from "@/features/bus/lib/bus-types";

const { getStaticBusTimetableDataMock } = vi.hoisted(() => ({
  getStaticBusTimetableDataMock: vi.fn(),
}));

vi.mock("@/features/bus/server/bus-timetable-data", () => ({
  getBusTimetableData: vi.fn(),
  getStaticBusTimetableData: getStaticBusTimetableDataMock,
}));

import { getNextDeparturesFromHubCampus } from "@/features/bus/server/bus-query-service";

function campus(id: number, namePrimary: string): BusCampusSummary {
  return {
    id,
    latitude: 0,
    longitude: 0,
    nameCn: namePrimary,
    nameEn: null,
    namePrimary,
    nameSecondary: null,
  };
}

const east = campus(1, "东区");
const west = campus(2, "西区");
const south = campus(4, "南区");

function trip(
  id: number,
  routeId: number,
  stops: Array<{ campus: BusCampusSummary; time: string }>,
): BusTripSummary {
  const stopTimes = stops.map((stop, index) => {
    const [hours, minutes] = stop.time.split(":").map(Number);
    return {
      campusId: stop.campus.id,
      campusName: stop.campus.namePrimary,
      isPassThrough: false,
      minutesSinceMidnight: hours * 60 + minutes,
      stopOrder: index + 1,
      time: stop.time,
    };
  });
  return {
    arrivalMinutes: stopTimes.at(-1)?.minutesSinceMidnight ?? null,
    arrivalTime: stopTimes.at(-1)?.time ?? null,
    dayType: "weekday",
    departureMinutes: stopTimes[0]?.minutesSinceMidnight ?? null,
    departureTime: stopTimes[0]?.time ?? null,
    id,
    position: id,
    routeId,
    stopTimes,
  };
}

/**
 * East is served by both routes, West and South by one each, so East is the
 * hub. West's soonest trip leaves after South's, which proves the board is
 * sorted by wait rather than by campus order.
 */
function timetable(): Omit<BusTimetableData, "preferences"> {
  return {
    availableVersions: [],
    campuses: [east, west, south],
    fetchedAt: "2026-04-22T01:00:00.000Z",
    locale: "zh-cn",
    notice: null,
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
      {
        descriptionPrimary: "东区 -> 南区",
        descriptionSecondary: null,
        id: 9,
        nameCn: "东区 -> 南区",
        nameEn: null,
        stops: [
          { campus: east, stopOrder: 1 },
          { campus: south, stopOrder: 2 },
        ],
      },
    ],
    trips: [
      trip(1, 8, [
        { campus: east, time: "10:00" },
        { campus: west, time: "10:20" },
      ]),
      trip(2, 9, [
        { campus: east, time: "09:30" },
        { campus: south, time: "09:50" },
      ]),
    ],
    version: null,
  };
}

describe("anonymous bus hub departures", () => {
  beforeEach(() => {
    getStaticBusTimetableDataMock.mockReset();
  });

  it("picks the best-connected campus and sorts its departures by wait", async () => {
    getStaticBusTimetableDataMock.mockResolvedValue(timetable());

    const board = await getNextDeparturesFromHubCampus({
      atTime: "2026-04-22T01:00:00.000Z",
      locale: "zh-cn",
    });

    expect(board?.originCampus.id).toBe(east.id);
    expect(
      board?.departures.map((departure) => [
        departure.destinationCampus?.namePrimary,
        departure.departureTime,
      ]),
    ).toEqual([
      ["南区", "09:30"],
      ["西区", "10:00"],
    ]);
  });

  it("returns null when no timetable version is effective", async () => {
    getStaticBusTimetableDataMock.mockResolvedValue(null);

    await expect(
      getNextDeparturesFromHubCampus({ locale: "zh-cn" }),
    ).resolves.toBeNull();
  });
});
