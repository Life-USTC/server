import { describe } from "vitest";
import * as fixtures from "../_harness";
import { createAnonymousMcpHarness } from "../_harness";
import { mcpTest } from "../_harness/context";

const toolTest = mcpTest.extend("context", fixtures.readerFixture());

describe("catalog_bus_timetable_get", () => {
  toolTest(
    "默认模式返回班车数据集的计数、校区与路线摘要",
    async ({ context, expect }) => {
      const result = await context.client.call<{
        locale?: string;
        fetchedAt?: string;
        version?: { key?: string; title?: string } | null;
        counts?: {
          campuses?: number;
          routes?: number;
          weekdayTrips?: number;
          saturdayTrips?: number;
          sundayTrips?: number;
        };
        campuses?: Array<{ id?: number; namePrimary?: string }>;
        routes?: Array<{ id?: number; nameCn?: string }>;
        preferences?: {
          preferredOriginCampusId?: number | null;
          preferredDestinationCampusId?: number | null;
          showDepartedTrips?: boolean;
        };
        nextDepartures?: unknown[];
        nextDeparturesMessage?: string | null;
      }>("catalog_bus_timetable_get", {
        locale: "zh-cn",
        mode: "default",
      });

      expect(result.locale).toBe("zh-cn");
      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.version?.key).toBe(fixtures.DEV_SEED.bus.versionKey);
      expect(result.version?.title).toBe(fixtures.DEV_SEED.bus.versionTitle);
      expect(typeof result.counts?.campuses).toBe("number");
      expect(typeof result.counts?.routes).toBe("number");
      expect(typeof result.counts?.weekdayTrips).toBe("number");
      expect(typeof result.counts?.saturdayTrips).toBe("number");
      expect(typeof result.counts?.sundayTrips).toBe("number");
      expect(result.campuses?.length).toBeGreaterThan(0);
      expect(result.routes?.length).toBeGreaterThan(0);
      expect(
        result.routes?.some((r) => r.id === fixtures.DEV_SEED.bus.routeId),
      ).toBe(true);
      expect(result.preferences).toBeNull();
      expect(Array.isArray(result.nextDepartures)).toBe(true);
    },
  );

  toolTest(
    "summary 兼容输入返回与 default 相同的紧凑路线结构",
    async ({ context, expect }) => {
      const result = await context.client.call<{
        locale?: string;
        counts?: {
          campuses?: number;
          routes?: number;
          weekdayTrips?: number;
          saturdayTrips?: number;
          sundayTrips?: number;
        };
        campuses?: unknown[];
        routes?: unknown[];
        preferences?: {
          preferredOriginCampusId?: number | null;
          preferredDestinationCampusId?: number | null;
          showDepartedTrips?: boolean;
        };
        nextDepartures?: unknown[];
        nextDeparturesMessage?: string | null;
      }>("catalog_bus_timetable_get", {
        locale: "zh-cn",
        mode: "default",
      });

      expect(result.locale).toBe("zh-cn");
      expect(typeof result.counts?.routes).toBe("number");
      expect(Array.isArray(result.campuses)).toBe(true);
      expect(Array.isArray(result.routes)).toBe(true);
      expect(result.preferences).toBeNull();
      expect(Array.isArray(result.nextDepartures)).toBe(true);
      expect(typeof result.nextDeparturesMessage).toBe("string");
    },
  );

  toolTest(
    "full 模式返回完整路线、班次与停靠站信息",
    async ({ context, expect }) => {
      const result = await context.client.call<{
        locale?: string;
        version?: { key?: string } | null;
        campuses?: Array<{
          id?: number;
          namePrimary?: string;
          latitude?: number;
        }>;
        routes?: Array<{
          id?: number;
          nameCn?: string;
          stops?: Array<{ stopOrder?: number; campus?: { id?: number } }>;
        }>;
        trips?: Array<{
          id?: number;
          routeId?: number;
          dayType?: string;
          stopTimes?: unknown[];
        }>;
        availableVersions?: unknown[];
        counts?: {
          routes?: number;
          weekdayTrips?: number;
          saturdayTrips?: number;
          sundayTrips?: number;
        };
        nextDepartures?: unknown[];
        nextDeparturesMessage?: string | null;
      }>("catalog_bus_timetable_get", {
        locale: "zh-cn",
        mode: "full",
      });

      expect(result.locale).toBe("zh-cn");
      expect(result.version?.key).toBe(fixtures.DEV_SEED.bus.versionKey);
      expect(result.campuses?.length).toBeGreaterThan(0);
      expect(result.routes?.length).toBeGreaterThan(0);
      expect(result.trips?.length).toBeGreaterThan(0);
      expect(result.availableVersions?.length).toBeGreaterThan(0);
      expect(typeof result.counts?.routes).toBe("number");
      expect(typeof result.counts?.weekdayTrips).toBe("number");
      expect(typeof result.counts?.saturdayTrips).toBe("number");
      expect(typeof result.counts?.sundayTrips).toBe("number");
      expect(Array.isArray(result.nextDepartures)).toBe(true);
      expect(result).toHaveProperty("nextDeparturesMessage");

      const route = result.routes?.find(
        (r) => r.id === fixtures.DEV_SEED.bus.routeId,
      );
      expect(route).toBeDefined();
      expect(route?.stops?.length).toBeGreaterThan(0);

      const trip = result.trips?.find(
        (t) => t.routeId === fixtures.DEV_SEED.bus.routeId,
      );
      expect(trip).toBeDefined();
      expect(trip?.dayType).toMatch(/weekday|saturday|sunday/);
    },
  );

  toolTest("支持通过 versionKey 指定版本", async ({ context, expect }) => {
    const result = await context.client.call<{
      version?: { key?: string } | null;
    }>("catalog_bus_timetable_get", {
      locale: "zh-cn",
      versionKey: fixtures.DEV_SEED.bus.versionKey,
    });

    expect(result.version?.key).toBe(fixtures.DEV_SEED.bus.versionKey);
  });

  toolTest("未认证调用返回公开时刻表且不包含个人偏好", async ({ expect }) => {
    const anonymous = await createAnonymousMcpHarness();
    try {
      const result = await anonymous.call<{ preferences?: unknown }>(
        "catalog_bus_timetable_get",
        { locale: "zh-cn" },
      );
      expect(result.preferences).toBeNull();
    } finally {
      await anonymous.close();
    }
  });
});

describe("catalog_bus_route_list", () => {
  toolTest("返回当前生效版本的路线与校区列表", async ({ context, expect }) => {
    const result = await context.client.call<{
      routes?: Array<{
        id?: number;
        nameCn?: string;
        nameEn?: string | null;
        descriptionPrimary?: string;
        stops?: Array<{
          stopOrder?: number;
          campusId?: number;
          campusName?: string;
        }>;
      }>;
      campuses?: Array<{
        id?: number;
        namePrimary?: string;
        nameSecondary?: string | null;
      }>;
    }>("catalog_bus_route_list", { locale: "zh-cn" });

    expect(result.routes?.length).toBeGreaterThan(0);
    expect(result.campuses?.length).toBeGreaterThan(0);

    const route = result.routes?.find(
      (r) => r.id === fixtures.DEV_SEED.bus.routeId,
    );
    expect(route).toBeDefined();
    expect(typeof route?.nameCn).toBe("string");
    expect(route?.stops?.length).toBeGreaterThan(0);
    expect(route?.stops?.[0]?.campusId).toBeTypeOf("number");
    expect(typeof route?.stops?.[0]?.campusName).toBe("string");

    expect(
      result.campuses?.some(
        (c) => c.id === fixtures.DEV_SEED.bus.originCampusId,
      ),
    ).toBe(true);
    expect(
      result.campuses?.some(
        (c) => c.id === fixtures.DEV_SEED.bus.destinationCampusId,
      ),
    ).toBe(true);
  });

  toolTest(
    "en-us locale 返回英文校区与路线名称",
    async ({ context, expect }) => {
      const result = await context.client.call<{
        routes?: Array<{ id?: number; nameEn?: string | null }>;
        campuses?: Array<{ id?: number; namePrimary?: string }>;
      }>("catalog_bus_route_list", { locale: "en-us" });

      const route = result.routes?.find(
        (r) => r.id === fixtures.DEV_SEED.bus.routeId,
      );
      expect(route?.nameEn).toBeTruthy();

      const campus = result.campuses?.find(
        (c) => c.id === fixtures.DEV_SEED.bus.originCampusId,
      );
      expect(campus?.namePrimary).toBe(fixtures.DEV_SEED.bus.originCampusName);
    },
  );
});

describe("catalog_bus_route_get", () => {
  toolTest("返回指定路线的平日与周日时刻表", async ({ context, expect }) => {
    const result = await context.client.call<{
      route?: {
        id?: number;
        nameCn?: string;
        stops?: Array<{ stopOrder?: number; campusId?: number }>;
      };
      weekday?: Array<{
        position?: number;
        stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
      }>;
      saturday?: Array<{
        position?: number;
        stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
      }>;
      sunday?: Array<{
        position?: number;
        stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
      }>;
      alternateRoutes?: Array<{ id?: number; nameCn?: string }>;
    }>("catalog_bus_route_get", {
      routeId: fixtures.DEV_SEED.bus.routeId,
      locale: "zh-cn",
      mode: "default",
    });

    expect(result.route?.id).toBe(fixtures.DEV_SEED.bus.routeId);
    expect(typeof result.route?.nameCn).toBe("string");
    expect(result.route?.stops?.length).toBeGreaterThan(0);
    expect(Array.isArray(result.weekday)).toBe(true);
    expect(Array.isArray(result.saturday)).toBe(true);
    expect(Array.isArray(result.sunday)).toBe(true);

    if (result.weekday && result.weekday.length > 0) {
      expect(result.weekday[0]?.stopTimes?.length).toBeGreaterThan(0);
      expect(typeof result.weekday[0]?.stopTimes?.[0]?.time).toBe("string");
    }

    if (result.sunday && result.sunday.length > 0) {
      expect(result.sunday[0]?.stopTimes?.length).toBeGreaterThan(0);
    }

    expect(Array.isArray(result.alternateRoutes)).toBe(true);
  });

  toolTest(
    "未知路线返回 hasData: false 与 catalog_bus_route_list 提示",
    async ({ context, expect }) => {
      const result = await context.client.call<{
        routeId?: number;
        hasData?: boolean;
        message?: string;
      }>("catalog_bus_route_get", {
        routeId: 2_147_483_647,
        locale: "zh-cn",
      });

      expect(result.routeId).toBe(2_147_483_647);
      expect(result.hasData).toBe(false);
      expect(result.message).toContain("catalog_bus_route_list");
    },
  );

  toolTest("无效 routeId 触发校验错误", async ({ context, expect }) => {
    await expect(
      context.client.call("catalog_bus_route_get", {
        routeId: 0,
        locale: "zh-cn",
      }),
    ).rejects.toThrow();

    await expect(
      context.client.call("catalog_bus_route_get", {
        routeId: -1,
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });
});

toolTest("mcp.bus-route-stop-projection", async ({ context, expect }) => {
  const outputs = [];
  for (const mode of ["default", "full"] as const) {
    const result = await context.client.call<{
      route: {
        stops: { stopOrder: number; campusId: number; campusName: string }[];
      };
      weekday: {
        position: number;
        stopTimes: { stopOrder: number; time: string | null }[];
      }[];
    }>("catalog_bus_route_get", {
      routeId: fixtures.DEV_SEED.bus.routeId,
      locale: "en-us",
      mode,
    });
    expect(result.route.stops.length).toBeGreaterThan(1);
    for (const stop of result.route.stops) {
      expect(stop.stopOrder).toEqual(expect.any(Number));
      expect(stop.campusId).toEqual(expect.any(Number));
      expect(stop.campusName.length).toBeGreaterThan(0);
    }
    expect(result.route.stops[0]).toMatchObject({
      campusId: fixtures.DEV_SEED.bus.originCampusId,
      campusName: fixtures.DEV_SEED.bus.originCampusName,
    });
    expect(result.weekday.length).toBeGreaterThan(0);
    outputs.push(result);
  }
  expect(outputs[0]?.route.stops).toEqual(outputs[1]?.route.stops);
  expect(outputs[0]?.weekday).toEqual(outputs[1]?.weekday);
});
