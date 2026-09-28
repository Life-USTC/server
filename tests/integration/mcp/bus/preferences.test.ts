import { describe } from "vitest";
import * as fixtures from "../_harness";
import { mcpTest } from "../_harness/context";

const toolTest = mcpTest.extend(
  "isolated",
  fixtures.actorFixture({
    emailPrefix: "mcp-bus",
    name: "[integration-test] Bus",
  }),
);

type BusPreferenceToolResponse = {
  preference?: {
    preferredOriginCampusId?: number | null;
    preferredDestinationCampusId?: number | null;
    showDepartedTrips?: boolean;
  };
};

describe("catalog_bus_departure_next — 默认模式去除重复的校区对象", () => {
  toolTest(
    "接受仅日期的 atTime 以确定发车查询",
    async ({ isolated, expect }) => {
      const result = await isolated.client.call<{ totalRoutes?: number }>(
        "catalog_bus_departure_next",
        {
          locale: "zh-cn",
          originCampusId: fixtures.DEV_SEED.bus.originCampusId,
          destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
          atTime: fixtures.SEED_DATE,
          limit: 50,
        },
      );

      expect(result.totalRoutes).toBeGreaterThan(0);
    },
  );

  toolTest(
    "拒绝超过共享 REST/MCP 上限的 limit",
    async ({ isolated, expect }) => {
      await expect(
        isolated.client.call("catalog_bus_departure_next", {
          locale: "zh-cn",
          originCampusId: fixtures.DEV_SEED.bus.originCampusId,
          destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
          limit: 51,
        }),
      ).rejects.toThrow();
    },
  );

  toolTest(
    "以共享 MCP 日期提示拒绝无效的 atTime",
    async ({ isolated, expect }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("catalog_bus_departure_next", {
        locale: "zh-cn",
        originCampusId: fixtures.DEV_SEED.bus.originCampusId,
        destinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
        atTime: "not-a-date",
      });

      expect(result).toMatchObject({
        success: false,
        message: "Invalid atTime. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+08:00.",
      });
    },
  );

  toolTest(
    "发车项省略 originCampus 和 destinationCampus",
    async ({ isolated, expect }) => {
      const result = await isolated.client.call<{
        originCampus?: { id?: number };
        destinationCampus?: { id?: number };
        totalRoutes?: number;
        departures?: Array<{
          routeId?: number;
          originCampus?: unknown;
          destinationCampus?: unknown;
        }>;
        message?: string | null;
      }>("catalog_bus_departure_next", {
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
    },
  );
});

describe("bus preference 工具", () => {
  function readPreference(isolated: fixtures.IsolatedMcpToolTestContext) {
    return isolated.client.call<BusPreferenceToolResponse>(
      "workspace_bus_preferences_get",
    );
  }

  toolTest(
    "读取、保存并重置已认证用户的 bus 偏好",
    async ({ isolated, expect }) => {
      const initial = await readPreference(isolated);

      expect(initial.preference).toEqual({
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      });

      const saved = await isolated.client.call<BusPreferenceToolResponse>(
        "workspace_bus_preferences_set",
        {
          preferredOriginCampusId: fixtures.DEV_SEED.bus.originCampusId,
          preferredDestinationCampusId:
            fixtures.DEV_SEED.bus.destinationCampusId,
          showDepartedTrips: true,
        },
      );

      expect(saved.preference).toEqual({
        preferredOriginCampusId: fixtures.DEV_SEED.bus.originCampusId,
        preferredDestinationCampusId: fixtures.DEV_SEED.bus.destinationCampusId,
        showDepartedTrips: true,
      });

      const readBack = await readPreference(isolated);

      expect(readBack.preference).toEqual(saved.preference);

      const reset = await isolated.client.call<BusPreferenceToolResponse>(
        "workspace_bus_preferences_set",
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
    },
  );

  toolTest("序列化未知校区校验失败且不写入", async ({ isolated, expect }) => {
    const before = await readPreference(isolated);

    const result = await isolated.client.call<{
      success?: boolean;
      error?: string;
      message?: string;
      hint?: string;
    }>("workspace_bus_preferences_set", {
      preferredOriginCampusId: 999_999_999,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });

    expect(result).toMatchObject({
      success: false,
      error: "invalid_bus_preference",
      message: "Unknown preferred origin campus",
    });
    expect(result.hint).toContain("catalog_bus_route_list");

    const readBack = await readPreference(isolated);

    expect(readBack.preference).toEqual(before.preference);
  });
});
