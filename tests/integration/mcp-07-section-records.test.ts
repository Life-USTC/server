import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("list_schedules_by_section — date range filter", () => {
  it("returns all schedules for the section when no date filter is given", async () => {
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

  it("narrows results to a specific week with dateFrom+dateTo bare dates", async () => {
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

  it("returns empty schedules array for a window with no matching schedules", async () => {
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

  it("returns error message for invalid dateFrom", async () => {
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

describe("query_schedules — flexible date filters", () => {
  it("accepts bare dates and returns paginated public schedules", async () => {
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

  it("returns a descriptive payload for invalid date filters", async () => {
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
