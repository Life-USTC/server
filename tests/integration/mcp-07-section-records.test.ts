import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("list_schedules_by_section — 日期范围筛选", () => {
  it("无日期筛选时返回该班级所有课程安排", async () => {
    const all = await context.client.call<{
      found?: boolean;
      schedules?: Array<{ id?: number; date?: string }>;
    }>("list_schedules_by_section", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(all.found).toBe(true);
    expect((all.schedules?.length ?? 0) > 0).toBe(true);
  });

  it("使用 dateFrom+dateTo 裸日期将结果缩小到特定周", async () => {
    const week = await context.client.call<{
      found?: boolean;
      schedules?: Array<{ id?: number; date?: string }>;
    }>("list_schedules_by_section", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_PLUS_SIX_DAYS,
      locale: "zh-cn",
    });

    expect(week.found).toBe(true);
    // Should only include schedules within the window
    for (const s of week.schedules ?? []) {
      if (s.date) {
        const d = s.date.slice(0, 10);
        expect(d >= fixtures.SEED_DATE).toBe(true);
        expect(d <= fixtures.SEED_PLUS_SIX_DAYS).toBe(true);
      }
    }
  });

  it("对无匹配课程安排的窗口返回空数组", async () => {
    const result = await context.client.call<{
      found?: boolean;
      schedules?: unknown[];
    }>("list_schedules_by_section", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      dateFrom: "2020-01-01",
      dateTo: "2020-01-07",
      locale: "zh-cn",
    });

    expect(result.found).toBe(true);
    expect(result.schedules).toHaveLength(0);
  });

  it("无效 dateFrom 返回错误消息", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("list_schedules_by_section", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      dateFrom: "yesterday",
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("yesterday");
  });
});

describe("query_schedules — 灵活日期筛选", () => {
  it("接受裸日期并返回分页公开课程安排", async () => {
    const result = await context.client.call<{
      data?: Array<{ date?: string; endTime?: unknown; startTime?: unknown }>;
      pagination?: { total?: number };
    }>("query_schedules", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_PLUS_SIX_DAYS,
      locale: "zh-cn",
    });

    expect(result.pagination?.total).toBeGreaterThan(0);
    expect(typeof result.data?.[0]?.startTime).toBe("string");
    expect(typeof result.data?.[0]?.endTime).toBe("string");
    for (const s of result.data ?? []) {
      if (s.date) {
        const d = s.date.slice(0, 10);
        expect(d >= fixtures.SEED_DATE).toBe(true);
        expect(d <= fixtures.SEED_PLUS_SIX_DAYS).toBe(true);
      }
    }
  });

  it("对无效日期筛选返回描述性载荷", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("query_schedules", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      dateFrom: "yesterday",
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("yesterday");
  });
});
