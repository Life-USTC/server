import { describe } from "vitest";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

const firstDay = "2026-04-29";
const throughDay = "2026-05-05";

describe("catalog_section_schedule_list — 日期范围筛选", () => {
  toolTest(
    "无日期筛选时返回该班级所有课程安排",
    { tags: ["@Catalog/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: context,
      mcpSection,
      mcpSchedules,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const all = await context.client.call<{
          found?: boolean;
          schedules?: Array<{ id?: number; date?: string }>;
        }>("catalog_section_schedule_list", {
          sectionJwId: mcpSection.jwId,
          locale: "zh-cn",
        });

        expect(all.found).toBe(true);
        expect((all.schedules?.length ?? 0) > 0).toBe(true);

        expect(all.schedules?.map((item) => item.id).sort()).toEqual(
          mcpSchedules.map((item) => item.id).sort(),
        );
      }),
  );

  toolTest(
    "使用 dateFrom+dateTo 裸日期将结果缩小到特定周",
    { tags: ["@Catalog/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: context,
      mcpSection,
      mcpSchedules,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const week = await context.client.call<{
          found?: boolean;
          schedules?: Array<{ id?: number; date?: string }>;
        }>("catalog_section_schedule_list", {
          sectionJwId: mcpSection.jwId,
          dateFrom: firstDay,
          dateTo: throughDay,
          locale: "zh-cn",
        });

        expect(week.found).toBe(true);
        // Should only include schedules within the window
        for (const s of week.schedules ?? []) {
          if (s.date) {
            const d = s.date.slice(0, 10);
            expect(d >= firstDay).toBe(true);
            expect(d <= throughDay).toBe(true);
          }
        }

        expect(week.schedules?.map((item) => item.id).sort()).toEqual(
          mcpSchedules
            .slice(0, 2)
            .map((item) => item.id)
            .sort(),
        );
      }),
  );

  toolTest(
    "对无匹配课程安排的窗口返回空数组",
    { tags: ["@Catalog/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: context,
      mcpSection,
      mcpSchedules: _schedules,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          found?: boolean;
          schedules?: unknown[];
        }>("catalog_section_schedule_list", {
          sectionJwId: mcpSection.jwId,
          dateFrom: "2020-01-01",
          dateTo: "2020-01-07",
          locale: "zh-cn",
        });

        expect(result.found).toBe(true);
        expect(result.schedules).toHaveLength(0);
      }),
  );

  toolTest(
    "无效 dateFrom 返回错误消息",
    { tags: ["@Catalog/MCP"] },
    async ({ mcpWorkflow, mcpActor: context, mcpSection, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          success?: boolean;
          message?: string;
        }>("catalog_section_schedule_list", {
          sectionJwId: mcpSection.jwId,
          dateFrom: "yesterday",
          locale: "zh-cn",
        });

        expect(result.success).toBe(false);
        expect(result.message).not.toContain("yesterday");
        expect(result.message).toContain("Invalid dateFrom");
        expect(result.message).toContain("YYYY-MM-DD");
      }),
  );
});

describe("catalog_schedule_list — 灵活日期筛选", () => {
  toolTest(
    "接受裸日期并返回分页公开课程安排",
    { tags: ["@Catalog/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: context,
      mcpSection,
      mcpSchedules,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          data?: Array<{
            id?: number;
            date?: string;
            endTime?: unknown;
            startTime?: unknown;
          }>;
          pagination?: { total?: number };
        }>("catalog_schedule_list", {
          sectionJwId: mcpSection.jwId,
          dateFrom: firstDay,
          dateTo: throughDay,
          locale: "zh-cn",
        });

        expect(result.pagination?.total).toBeGreaterThan(0);
        expect(typeof result.data?.[0]?.startTime).toBe("string");
        expect(typeof result.data?.[0]?.endTime).toBe("string");
        for (const s of result.data ?? []) {
          if (s.date) {
            const d = s.date.slice(0, 10);
            expect(d >= firstDay).toBe(true);
            expect(d <= throughDay).toBe(true);
          }
        }

        expect(result.data?.map((item) => item.id).sort()).toEqual(
          mcpSchedules
            .slice(0, 2)
            .map((item) => item.id)
            .sort(),
        );
        expect(result.pagination?.total).toBe(2);
      }),
  );

  toolTest(
    "对无效日期筛选返回描述性载荷",
    { tags: ["@Catalog/MCP"] },
    async ({ mcpWorkflow, mcpActor: context, mcpSection, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          success?: boolean;
          message?: string;
        }>("catalog_schedule_list", {
          sectionJwId: mcpSection.jwId,
          dateFrom: "yesterday",
          locale: "zh-cn",
        });

        expect(result.success).toBe(false);
        expect(result.message).not.toContain("yesterday");
        expect(result.message).toContain("Invalid dateFrom");
        expect(result.message).toContain("YYYY-MM-DD");
      }),
  );
});
