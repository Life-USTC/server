import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

async function createAnonymousMcpHarness() {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpServer = createMcpServer();
  const client = new Client({
    name: "integration-test-anonymous",
    version: "1.0.0",
  });

  await mcpServer.connect(serverTransport);
  await client.connect(clientTransport);

  function isTextContentItem(
    value: unknown,
  ): value is { type: "text"; text: string } {
    return (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      value.type === "text" &&
      "text" in value &&
      typeof value.text === "string"
    );
  }

  async function call<T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const textItem = content.find(isTextContentItem);
    if (!textItem) {
      throw new Error("MCP tool returned no text content");
    }
    return JSON.parse(textItem.text) as T;
  }

  async function close() {
    await client.close();
  }

  return { call, close };
}

describe("query_bus_timetable", () => {
  it("默认模式返回班车数据集的计数、校区与路线摘要", async () => {
    const result = await context.client.call<{
      locale?: string;
      fetchedAt?: string;
      version?: { key?: string; title?: string } | null;
      counts?: {
        campuses?: number;
        routes?: number;
        weekdayTrips?: number;
        weekendTrips?: number;
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
    }>("query_bus_timetable", {
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
    expect(typeof result.counts?.weekendTrips).toBe("number");
    expect(result.campuses?.length).toBeGreaterThan(0);
    expect(result.routes?.length).toBeGreaterThan(0);
    expect(
      result.routes?.some((r) => r.id === fixtures.DEV_SEED.bus.routeId),
    ).toBe(true);
    expect(result.preferences).toEqual({
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });
    expect(Array.isArray(result.nextDepartures)).toBe(true);
  });

  it("summary 兼容输入返回与 default 相同的紧凑路线结构", async () => {
    const result = await context.client.call<{
      locale?: string;
      counts?: {
        campuses?: number;
        routes?: number;
        weekdayTrips?: number;
        weekendTrips?: number;
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
    }>("query_bus_timetable", {
      locale: "zh-cn",
      mode: "summary",
    });

    expect(result.locale).toBe("zh-cn");
    expect(typeof result.counts?.routes).toBe("number");
    expect(Array.isArray(result.campuses)).toBe(true);
    expect(Array.isArray(result.routes)).toBe(true);
    expect(result.preferences).toBeDefined();
    expect(Array.isArray(result.nextDepartures)).toBe(true);
    expect(typeof result.nextDeparturesMessage).toBe("string");
  });

  it("full 模式返回完整路线、班次与停靠站信息", async () => {
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
      counts?: { routes?: number; weekdayTrips?: number };
      nextDepartures?: unknown[];
      nextDeparturesMessage?: string | null;
    }>("query_bus_timetable", {
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
    expect(trip?.dayType).toMatch(/weekday|weekend/);
  });

  it("支持通过 versionKey 指定版本", async () => {
    const result = await context.client.call<{
      version?: { key?: string } | null;
    }>("query_bus_timetable", {
      locale: "zh-cn",
      versionKey: fixtures.DEV_SEED.bus.versionKey,
    });

    expect(result.version?.key).toBe(fixtures.DEV_SEED.bus.versionKey);
  });

  it("未认证调用因缺少用户上下文而被拒绝", async () => {
    const anonymous = await createAnonymousMcpHarness();
    try {
      await expect(
        anonymous.call("query_bus_timetable", { locale: "zh-cn" }),
      ).rejects.toThrow();
    } finally {
      await anonymous.close();
    }
  });
});

describe("list_bus_routes", () => {
  it("返回当前生效版本的路线与校区列表", async () => {
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
    }>("list_bus_routes", { locale: "zh-cn" });

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

  it("en-us locale 返回英文校区与路线名称", async () => {
    const result = await context.client.call<{
      routes?: Array<{ id?: number; nameEn?: string | null }>;
      campuses?: Array<{ id?: number; namePrimary?: string }>;
    }>("list_bus_routes", { locale: "en-us" });

    const route = result.routes?.find(
      (r) => r.id === fixtures.DEV_SEED.bus.routeId,
    );
    expect(route?.nameEn).toBeTruthy();

    const campus = result.campuses?.find(
      (c) => c.id === fixtures.DEV_SEED.bus.originCampusId,
    );
    expect(campus?.namePrimary).toBe(fixtures.DEV_SEED.bus.originCampusName);
  });
});

describe("get_bus_route_timetable", () => {
  it("返回指定路线的平日与周末时刻表", async () => {
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
      weekend?: Array<{
        position?: number;
        stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
      }>;
      alternateRoutes?: Array<{ id?: number; nameCn?: string }>;
    }>("get_bus_route_timetable", {
      routeId: fixtures.DEV_SEED.bus.routeId,
      locale: "zh-cn",
      mode: "default",
    });

    expect(result.route?.id).toBe(fixtures.DEV_SEED.bus.routeId);
    expect(typeof result.route?.nameCn).toBe("string");
    expect(result.route?.stops?.length).toBeGreaterThan(0);
    expect(Array.isArray(result.weekday)).toBe(true);
    expect(Array.isArray(result.weekend)).toBe(true);

    if (result.weekday && result.weekday.length > 0) {
      expect(result.weekday[0]?.stopTimes?.length).toBeGreaterThan(0);
      expect(typeof result.weekday[0]?.stopTimes?.[0]?.time).toBe("string");
    }

    if (result.weekend && result.weekend.length > 0) {
      expect(result.weekend[0]?.stopTimes?.length).toBeGreaterThan(0);
    }

    expect(Array.isArray(result.alternateRoutes)).toBe(true);
  });

  it("未知路线返回 hasData: false 与 list_bus_routes 提示", async () => {
    const result = await context.client.call<{
      routeId?: number;
      hasData?: boolean;
      message?: string;
    }>("get_bus_route_timetable", {
      routeId: 2_147_483_647,
      locale: "zh-cn",
    });

    expect(result.routeId).toBe(2_147_483_647);
    expect(result.hasData).toBe(false);
    expect(result.message).toContain("list_bus_routes");
  });

  it("无效 routeId 触发校验错误", async () => {
    await expect(
      context.client.call("get_bus_route_timetable", {
        routeId: 0,
        locale: "zh-cn",
      }),
    ).rejects.toThrow();

    await expect(
      context.client.call("get_bus_route_timetable", {
        routeId: -1,
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });
});
