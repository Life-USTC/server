import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

type BusPreferenceToolResponse = {
  preference?: {
    preferredOriginCampusId?: number | null;
    preferredDestinationCampusId?: number | null;
    showDepartedTrips?: boolean;
  };
};

describe("get_next_buses — 默认模式去除重复的校区对象", () => {
  it("接受仅日期的 atTime 以确定发车查询", async () => {
    const result = await context.client.call<{ totalRoutes?: number }>(
      "get_next_buses",
      {
        locale: "zh-cn",
        originCampusId: fixtures.DEV_SEED.bus.originCampusId,
        destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
        atTime: fixtures.SEED_DATE,
        limit: 50,
      },
    );

    expect(result.totalRoutes).toBeGreaterThan(0);
  });

  it("拒绝超过共享 REST/MCP 上限的 limit", async () => {
    await expect(
      context.client.call("get_next_buses", {
        locale: "zh-cn",
        originCampusId: fixtures.DEV_SEED.bus.originCampusId,
        destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
        limit: 51,
      }),
    ).rejects.toThrow();
  });

  it("以共享 MCP 日期提示拒绝无效的 atTime", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("get_next_buses", {
      locale: "zh-cn",
      originCampusId: fixtures.DEV_SEED.bus.originCampusId,
      destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
      atTime: "not-a-date",
    });

    expect(result).toMatchObject({
      success: false,
      message:
        'Invalid atTime: "not-a-date". Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+08:00.',
    });
  });

  it("发车项省略 originCampus 和 destinationCampus", async () => {
    const result = await context.client.call<{
      originCampus?: { id?: number };
      destinationCampus?: { id?: number };
      totalRoutes?: number;
      departures?: Array<{
        routeId?: number;
        originCampus?: unknown;
        destinationCampus?: unknown;
      }>;
      message?: string | null;
    }>("get_next_buses", {
      locale: "zh-cn",
      originCampusId: fixtures.DEV_SEED.bus.originCampusId,
      destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
    });

    expect(result.totalRoutes).toBeGreaterThan(0);
    if ((result.departures?.length ?? 0) > 0) {
      // Campus info is at the top level, not repeated per departure
      expect(result.originCampus).toBeDefined();
      for (const dep of result.departures ?? []) {
        expect(dep).not.toHaveProperty("originCampus");
        expect(dep).not.toHaveProperty("destinationCampus");
      }
    } else {
      // No departures → guidance message should be present
      expect(typeof result.message).toBe("string");
    }
  });
});

describe("bus preference 工具", () => {
  let preferenceUserId: string | null = null;
  let preferenceMcp: McpHarness | undefined;

  beforeAll(async () => {
    const user = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("bus-preferences"),
        name: "Bus Preference Integration",
      },
      select: { id: true },
    });
    preferenceUserId = user.id;
    preferenceMcp = await createMcpHarness(user.id);
  });

  afterAll(async () => {
    await preferenceMcp?.close();
    if (preferenceUserId) {
      await fixtures.prisma.user.deleteMany({
        where: { id: preferenceUserId },
      });
    }
  });

  function preferenceHarness() {
    if (!preferenceMcp) {
      throw new Error("Bus preference MCP harness was not initialized");
    }
    return preferenceMcp;
  }

  function readPreference() {
    return preferenceHarness().call<BusPreferenceToolResponse>(
      "get_my_bus_preferences",
    );
  }

  it("读取、保存并重置已认证用户的 bus 偏好", async () => {
    const initial = await readPreference();

    expect(initial.preference).toEqual({
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });

    const saved = await preferenceHarness().call<BusPreferenceToolResponse>(
      "save_my_bus_preferences",
      {
        preferredOriginCampusId: fixtures.DEV_SEED.bus.originCampusId,
        preferredDestinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
        showDepartedTrips: true,
      },
    );

    expect(saved.preference).toEqual({
      preferredOriginCampusId: fixtures.DEV_SEED.bus.originCampusId,
      preferredDestinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
      showDepartedTrips: true,
    });

    const readBack = await readPreference();

    expect(readBack.preference).toEqual(saved.preference);

    const reset = await preferenceHarness().call<BusPreferenceToolResponse>(
      "save_my_bus_preferences",
      {
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    );

    expect(reset.preference).toEqual({
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });
  });

  it("序列化未知校区校验失败且不写入", async () => {
    const before = await readPreference();

    const result = await preferenceHarness().call<{
      success?: boolean;
      error?: string;
      message?: string;
      hint?: string;
    }>("save_my_bus_preferences", {
      preferredOriginCampusId: 999_999_999,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });

    expect(result).toMatchObject({
      success: false,
      error: "invalid_bus_preference",
      message: "Unknown preferred origin campus",
    });
    expect(result.hint).toContain("list_bus_routes");

    const readBack = await readPreference();

    expect(readBack.preference).toEqual(before.preference);
  });
});

// ---------------------------------------------------------------------------
// Section subscription tools — compact mutation responses
// ---------------------------------------------------------------------------
