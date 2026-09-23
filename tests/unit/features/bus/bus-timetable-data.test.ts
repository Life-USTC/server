import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import { createDeferred } from "../../../shared/deferred";

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
    saturday_routes: [],
    sunday_routes: [],
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
    busCampusFindMany: vi.fn(),
    busPreferenceFindUnique: vi.fn(),
    busRouteFindMany: vi.fn(),
    busScheduleVersionFindMany: vi.fn(),
    busScheduleVersionFindUnique: vi.fn(),
    busTripFindMany: vi.fn(),
    latestCampuses,
    latestVersion,
    oldPayload,
    oldVersion,
  };
});

vi.mock("@/lib/site-url", () => ({
  getCanonicalOrigin: () => "https://life.example",
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn().mockResolvedValue("test-revision"),
}));

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
  withUserDbContext: async (
    _userId: string,
    run: (tx: {
      busUserPreference: { findUnique: typeof db.busPreferenceFindUnique };
    }) => Promise<unknown>,
  ) =>
    run({
      busUserPreference: { findUnique: db.busPreferenceFindUnique },
    }),
}));

import { PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS } from "@/lib/catalog-runtime-cache";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

type TimetableModule =
  typeof import("@/features/bus/server/bus-timetable-data");
type QueryServiceModule =
  typeof import("@/features/bus/server/bus-query-service");
type TransitMapModule = typeof import("@/features/bus/server/bus-transit-map");

let timetable: TimetableModule;
let queryService: QueryServiceModule;
let transitMap: TransitMapModule;

function versionLookupCount(key: string) {
  return db.busScheduleVersionFindUnique.mock.calls.filter(([args]) => {
    const where = (args as { where?: { key?: string } }).where;
    return where?.key === key;
  }).length;
}

function resetDbMocks() {
  db.busCampusFindMany.mockReset().mockResolvedValue(db.latestCampuses);
  db.busPreferenceFindUnique.mockReset().mockResolvedValue(null);
  db.busRouteFindMany.mockReset().mockResolvedValue([
    {
      id: 8,
      nameCn: "东区 -> 西区 -> 高新",
      nameEn: null,
      stops: db.latestCampuses.map((campus, index) => ({
        stopOrder: index,
        campus,
      })),
    },
  ]);
  db.busScheduleVersionFindMany
    .mockReset()
    .mockResolvedValue([db.latestVersion, db.oldVersion]);
  db.busScheduleVersionFindUnique
    .mockReset()
    .mockImplementation(async (args: unknown) => {
      const where = (args as { where: { id?: number; key?: string } }).where;
      if (where.id === db.oldVersion.id) return { rawJson: db.oldPayload };
      if (where.key === "missing-bus") return null;
      if (where.key) return { ...db.oldVersion, key: where.key };
      return null;
    });
  db.busTripFindMany.mockReset().mockResolvedValue([
    {
      id: 101,
      versionId: db.oldVersion.id,
      routeId: 8,
      dayType: "weekday" as const,
      position: 0,
      stopTimes: ["08:00", "08:20"],
    },
  ]);
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-07-30T00:00:00.000Z");
  vi.resetModules();
  resetPublicRuntimeCacheForTest();
  resetDbMocks();
  timetable = await import("@/features/bus/server/bus-timetable-data");
  queryService = await import("@/features/bus/server/bus-query-service");
  transitMap = await import("@/features/bus/server/bus-transit-map");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getBusTimetableData 班车时刻表数据", () => {
  it("使用请求历史版本的拓扑结构", async () => {
    const data = await timetable.getBusTimetableData({
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

  it("catalog_bus_departure_next 复用静态时刻表缓存", async () => {
    await timetable.getBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    vi.clearAllMocks();

    const data = await queryService.getNextBusDepartures({
      locale: "zh-cn",
      originCampusId: 1,
      destinationCampusId: 2,
      atTime: "2026-01-31T23:30:00.000Z",
      dayType: "weekday",
      versionKey: "old-bus",
    });

    expect(data?.departures[0]?.departureTime).toBe("08:00");
    expect(db.busTripFindMany).not.toHaveBeenCalled();
    expect(db.busScheduleVersionFindMany).toHaveBeenCalledTimes(1);
    expect(versionLookupCount("old-bus")).toBe(1);
    expect(db.busCampusFindMany).not.toHaveBeenCalled();
    expect(db.busRouteFindMany).not.toHaveBeenCalled();
  });

  it("bus map 复用静态时刻表缓存并按请求时间重算 active trips", async () => {
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-02T00:00:00.000Z",
      versionKey: "old-bus",
    });
    vi.clearAllMocks();

    const data = await transitMap.getBusMapData({
      locale: "zh-cn",
      now: "2026-02-02T00:05:00.000Z",
      versionKey: "old-bus",
    });

    expect(data?.now).toBe("2026-02-02T00:05:00.000Z");
    expect(data?.activeTrips).toEqual([
      expect.objectContaining({ routeId: 8, status: "en-route" }),
    ]);
    expect(db.busTripFindMany).not.toHaveBeenCalled();
    expect(db.busScheduleVersionFindMany).toHaveBeenCalledTimes(1);
    expect(versionLookupCount("old-bus")).toBe(1);
  });

  it("为每次调用刷新 fetchedAt 而不重新加载静态数据", async () => {
    const first = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    const second = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T01:00:00.000Z",
      versionKey: "old-bus",
    });

    expect(first?.fetchedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(second?.fetchedAt).toBe("2026-02-01T01:00:00.000Z");
    expect(versionLookupCount("old-bus")).toBe(2);
    expect(db.busTripFindMany).toHaveBeenCalledTimes(1);
  });

  it("同一版本重新导入后按 importedAt 刷新静态数据", async () => {
    const input = {
      locale: "zh-cn" as const,
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    };
    const first = await timetable.getStaticBusTimetableData(input);

    db.busScheduleVersionFindUnique.mockImplementation(
      async (args: unknown) => {
        const where = (args as { where: { id?: number; key?: string } }).where;
        if (where.id === db.oldVersion.id) return { rawJson: db.oldPayload };
        if (where.key === "old-bus") {
          return {
            ...db.oldVersion,
            importedAt: new Date("2026-07-30T00:01:00.000Z"),
          };
        }
        return null;
      },
    );
    db.busTripFindMany.mockResolvedValue([
      {
        id: 102,
        versionId: db.oldVersion.id,
        routeId: 8,
        dayType: "weekday" as const,
        position: 0,
        stopTimes: ["09:00", "09:20"],
      },
    ]);

    const second = await timetable.getStaticBusTimetableData(input);

    expect(first?.trips[0]?.departureTime).toBe("08:00");
    expect(second?.trips[0]?.departureTime).toBe("09:00");
    expect(db.busTripFindMany).toHaveBeenCalledTimes(2);
  });

  it("不把调用者偏好放进静态缓存", async () => {
    db.busPreferenceFindUnique.mockImplementation(async (args: unknown) => {
      const userId = (args as { where: { userId: string } }).where.userId;
      return {
        preferredOriginCampusId: userId === "user-a" ? 1 : 2,
        preferredDestinationCampusId: null,
        showDepartedTrips: userId === "user-b",
      };
    });

    const first = await timetable.getBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      userId: "user-a",
      versionKey: "old-bus",
    });
    const second = await timetable.getBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      userId: "user-b",
      versionKey: "old-bus",
    });

    expect(first?.preferences?.preferredOriginCampusId).toBe(1);
    expect(second?.preferences).toMatchObject({
      preferredOriginCampusId: 2,
      showDepartedTrips: true,
    });
    expect(versionLookupCount("old-bus")).toBe(2);
    expect(db.busPreferenceFindUnique).toHaveBeenCalledTimes(2);
  });

  it("按 locale、日期和显式版本隔离静态数据", async () => {
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "1998-01-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    await timetable.getStaticBusTimetableData({
      locale: "en-us",
      now: "1998-01-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "1998-01-02T00:00:00.000Z",
      versionKey: "old-bus",
    });
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "1998-01-01T00:00:00.000Z",
      versionKey: "another-bus",
    });

    expect(db.busTripFindMany).toHaveBeenCalledTimes(4);
    expect(versionLookupCount("old-bus")).toBe(3);
    expect(versionLookupCount("another-bus")).toBe(1);
  });

  it("区分自动选择与合法的显式 auto 版本", async () => {
    const automatic = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
    });
    const explicit = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "auto",
    });
    const automaticAgain = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
    });

    expect(automatic?.version?.key).toBe("old-bus");
    expect(explicit?.version?.key).toBe("auto");
    expect(automaticAgain?.version?.key).toBe("old-bus");
    expect(versionLookupCount("auto")).toBe(1);
    expect(db.busTripFindMany).toHaveBeenCalledTimes(2);
  });

  it("并发启动 enabled versions 与显式版本读取", async () => {
    vi.useRealTimers();
    const versions = createDeferred<unknown>();
    const explicitVersion = createDeferred<unknown>();
    db.busScheduleVersionFindMany.mockReturnValueOnce(versions.promise);
    db.busScheduleVersionFindUnique.mockReturnValueOnce(
      explicitVersion.promise,
    );

    const result = timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    await flushAsyncWork();

    expect(db.busScheduleVersionFindMany).toHaveBeenCalledTimes(1);
    expect(versionLookupCount("old-bus")).toBe(1);

    versions.resolve([db.latestVersion, db.oldVersion]);
    explicitVersion.resolve(db.oldVersion);
    await expect(result).resolves.toMatchObject({
      version: { key: "old-bus" },
    });
  });

  it("版本检查后合并同 key 并发静态加载", async () => {
    vi.useRealTimers();
    const explicitVersion = createDeferred<unknown>();
    db.busScheduleVersionFindUnique.mockReturnValueOnce(
      explicitVersion.promise,
    );

    const first = timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    });
    const second = timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T01:00:00.000Z",
      versionKey: "old-bus",
    });
    await flushAsyncWork();

    expect(versionLookupCount("old-bus")).toBe(2);
    vi.setSystemTime("2026-07-30T00:01:01.000Z");
    explicitVersion.resolve(db.oldVersion);

    const [firstData, secondData] = await Promise.all([first, second]);
    const third = await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T02:00:00.000Z",
      versionKey: "old-bus",
    });

    expect(firstData?.fetchedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(secondData?.fetchedAt).toBe("2026-02-01T01:00:00.000Z");
    expect(third?.fetchedAt).toBe("2026-02-01T02:00:00.000Z");
    expect(versionLookupCount("old-bus")).toBe(3);
  });

  it("不缓存最终 null", async () => {
    const input = {
      locale: "zh-cn" as const,
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "missing-bus",
    };

    await expect(
      timetable.getStaticBusTimetableData(input),
    ).resolves.toBeNull();
    await expect(
      timetable.getStaticBusTimetableData(input),
    ).resolves.toBeNull();

    expect(versionLookupCount("missing-bus")).toBe(2);
    expect(db.busTripFindMany).not.toHaveBeenCalled();
  });

  it("加载失败后允许下一次调用重试", async () => {
    db.busScheduleVersionFindUnique.mockRejectedValueOnce(
      new Error("version read failed"),
    );
    const input = {
      locale: "zh-cn" as const,
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "old-bus",
    };

    await expect(timetable.getStaticBusTimetableData(input)).rejects.toThrow(
      "version read failed",
    );
    await expect(
      timetable.getStaticBusTimetableData(input),
    ).resolves.toMatchObject({ version: { key: "old-bus" } });

    expect(versionLookupCount("old-bus")).toBe(2);
  });

  it("有其他并发 key 时仍合并同 key 加载", async () => {
    vi.useRealTimers();
    const raceVersion = createDeferred<unknown>();
    const blockedVersions = createDeferred<unknown>();
    let raceLookups = 0;
    db.busScheduleVersionFindUnique.mockImplementation(
      async (args: unknown) => {
        const where = (args as { where: { id?: number; key?: string } }).where;
        if (where.id === db.oldVersion.id) return { rawJson: db.oldPayload };
        if (where.key === "race-bus") {
          raceLookups += 1;
          return raceVersion.promise;
        }
        if (where.key?.startsWith("blocked-")) {
          return blockedVersions.promise;
        }
        return null;
      },
    );

    const first = timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "race-bus",
    });
    await flushAsyncWork();
    const blocked = Array.from({ length: 10 }, (_, index) =>
      timetable.getStaticBusTimetableData({
        locale: "zh-cn",
        now: "2026-02-01T00:00:00.000Z",
        versionKey: `blocked-${index}`,
      }),
    );
    const second = timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "race-bus",
    });
    await flushAsyncWork();

    expect(raceLookups).toBe(2);
    raceVersion.resolve({ ...db.oldVersion, key: "race-bus" });
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({
        version: expect.objectContaining({ key: "race-bus" }),
      }),
      expect.objectContaining({
        version: expect.objectContaining({ key: "race-bus" }),
      }),
    ]);

    blockedVersions.resolve(null);
    await expect(Promise.all(blocked)).resolves.toEqual(
      Array.from({ length: 10 }, () => null),
    );
  });

  it("把成功静态缓存限制为 100 项", async () => {
    for (let index = 0; index < 101; index += 1) {
      await timetable.getStaticBusTimetableData({
        locale: "zh-cn",
        now: "2026-02-01T00:00:00.000Z",
        versionKey: `bounded-${index}`,
      });
    }

    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "bounded-0",
    });

    expect(versionLookupCount("bounded-0")).toBe(2);
  });

  it("未知版本解析为 null 后不淘汰已有成功项", async () => {
    for (let index = 0; index < 99; index += 1) {
      await timetable.getStaticBusTimetableData({
        locale: "zh-cn",
        now: "2026-02-01T00:00:00.000Z",
        versionKey: `valid-${index}`,
      });
    }

    await expect(
      timetable.getStaticBusTimetableData({
        locale: "zh-cn",
        now: "2026-02-01T00:00:00.000Z",
        versionKey: "missing-bus",
      }),
    ).resolves.toBeNull();
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "valid-0",
    });

    expect(versionLookupCount("valid-0")).toBe(2);
  });

  it("每次访问都会清理所有过期成功项", async () => {
    for (const versionKey of ["expiry-a", "expiry-b"]) {
      await timetable.getStaticBusTimetableData({
        locale: "zh-cn",
        now: "2026-02-01T00:00:00.000Z",
        versionKey,
      });
    }

    vi.setSystemTime(
      new Date(
        new Date("2026-07-30T00:00:00.000Z").getTime() +
          PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS +
          1,
      ),
    );
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "expiry-c",
    });

    vi.setSystemTime(
      new Date(
        new Date("2026-07-30T00:00:00.000Z").getTime() +
          PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS +
          1,
      ),
    );
    await timetable.getStaticBusTimetableData({
      locale: "zh-cn",
      now: "2026-02-01T00:00:00.000Z",
      versionKey: "expiry-a",
    });

    expect(versionLookupCount("expiry-a")).toBe(2);
  });
});
