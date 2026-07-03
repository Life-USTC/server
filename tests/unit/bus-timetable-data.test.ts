import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import { getNextBusDepartures } from "@/features/bus/server/bus-query-service";
import { getBusTimetableData } from "@/features/bus/server/bus-timetable-data";

const db = vi.hoisted(() => {
  const east = { id: 1, name: "东区", latitude: 31.1, longitude: 117.1 };
  const west = { id: 2, name: "西区", latitude: 31.2, longitude: 117.2 };
  const highTech = {
    id: 6,
    name: "高新",
    latitude: 31.6,
    longitude: 117.6,
  };
  const oldPayload = {
    campuses: [east, west],
    routes: [{ id: 8, campuses: [east, west] }],
    weekday_routes: [
      { id: 1, route: { id: 8, campuses: [east, west] }, time: [] },
    ],
    weekend_routes: [],
    message: null,
  } satisfies BusStaticPayload;

  const oldVersion = {
    id: 1,
    key: "old-bus",
    title: "Old bus schedule",
    sourceMessage: null,
    sourceUrl: null,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveUntil: new Date("2026-03-31T00:00:00.000Z"),
    importedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const latestVersion = {
    id: 2,
    key: "latest-bus",
    title: "Latest bus schedule",
    sourceMessage: null,
    sourceUrl: null,
    effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
    effectiveUntil: null,
    importedAt: new Date("2026-04-01T00:00:00.000Z"),
  };
  const latestCampuses = [
    {
      id: east.id,
      nameCn: east.name,
      nameEn: null,
      namePrimary: east.name,
      nameSecondary: null,
      latitude: east.latitude,
      longitude: east.longitude,
    },
    {
      id: west.id,
      nameCn: west.name,
      nameEn: null,
      namePrimary: west.name,
      nameSecondary: null,
      latitude: west.latitude,
      longitude: west.longitude,
    },
    {
      id: highTech.id,
      nameCn: highTech.name,
      nameEn: null,
      namePrimary: highTech.name,
      nameSecondary: null,
      latitude: highTech.latitude,
      longitude: highTech.longitude,
    },
  ];

  return {
    busCampusFindMany: vi.fn(async () => latestCampuses),
    busRouteFindMany: vi.fn(async () => [
      {
        id: 8,
        nameCn: "东区 -> 西区 -> 高新",
        nameEn: null,
        stops: latestCampuses.map((campus, index) => ({
          stopOrder: index,
          campus,
        })),
      },
    ]),
    busScheduleVersionFindMany: vi.fn(async () => [latestVersion, oldVersion]),
    busScheduleVersionFindUnique: vi.fn(async (args: unknown) => {
      const where = (args as { where: { id?: number; key?: string } }).where;
      if (where.key === oldVersion.key) return oldVersion;
      if (where.id === oldVersion.id) return { rawJson: oldPayload };
      return null;
    }),
    busTripFindMany: vi.fn(async () => [
      {
        id: 101,
        versionId: oldVersion.id,
        routeId: 8,
        dayType: "weekday" as const,
        position: 0,
        stopTimes: ["08:00", "08:20"],
      },
    ]),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    busCampus: { findMany: db.busCampusFindMany },
    busRoute: { findMany: db.busRouteFindMany },
  }),
  prisma: {
    busScheduleVersion: {
      findMany: db.busScheduleVersionFindMany,
      findUnique: db.busScheduleVersionFindUnique,
    },
    busTrip: { findMany: db.busTripFindMany },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBusTimetableData 班车时刻表数据", () => {
  it("使用请求历史版本的拓扑结构", async () => {
    const data = await getBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });

    expect(data?.version?.key).toBe("old-bus");
    expect(data?.campuses.map((campus) => campus.id)).toEqual([1, 2]);

    const route = data?.routes.find((candidate) => candidate.id === 8);
    expect(route?.stops.map((stop) => stop.campus.id)).toEqual([1, 2]);
    expect(route?.descriptionPrimary).toBe("东区 -> 西区");

    const trip = data?.trips[0];
    expect(trip?.routeId).toBe(8);
    expect(trip?.stopTimes.map((stop) => stop.campusId)).toEqual([1, 2]);
    expect(trip?.arrivalTime).toBe("08:20");
  });

  it("get_next_buses 复用静态时刻表缓存", async () => {
    await getBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    vi.clearAllMocks();

    const data = await getNextBusDepartures({
      locale: "zh-cn",
      originCampusId: 1,
      destinationCampusId: 2,
      atTime: "2026-01-31T23:30:00.000Z",
      dayType: "weekday",
      versionKey: "old-bus",
    });

    expect(data?.departures[0]?.departureTime).toBe("08:00");
    expect(db.busTripFindMany).not.toHaveBeenCalled();
    expect(db.busScheduleVersionFindMany).not.toHaveBeenCalled();
    expect(db.busScheduleVersionFindUnique).not.toHaveBeenCalled();
    expect(db.busCampusFindMany).not.toHaveBeenCalled();
    expect(db.busRouteFindMany).not.toHaveBeenCalled();
  });
});
