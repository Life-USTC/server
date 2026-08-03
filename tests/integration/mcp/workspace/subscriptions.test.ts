// Merged from mcp-12-subscriptions + mcp-18-calendar-subscriptions

import { describe, expect, it } from "vitest";
import * as fixtures from "../_harness";
import { createMcpHarness } from "../_harness";

const subscriber = fixtures.createIsolatedMcpToolTestContext({
  emailPrefix: "mcp-subscriptions",
  name: "MCP Subscription Integration",
});

describe("workspace_subscription_add — 返回 action 与精简订阅", () => {
  it("订阅返回 action=subscribed 或 action=already_subscribed", async () => {
    const result = await subscriber.client.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: {
        sectionCount?: number;
        currentSemesterSections?: unknown;
        sections?: unknown;
      } | null;
    }>("workspace_subscription_add", {
      jwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(["subscribed", "already_subscribed"]).toContain(result.action);
    expect(result.sectionJwId).toBe(fixtures.DEV_SEED.section.jwId);
    // Brief subscription — sections list not included in default mode
    expect(result.subscription?.sections).toBeUndefined();
    expect(result.subscription?.currentSemesterSections).toBeUndefined();
    expect(typeof result.subscription?.sectionCount).toBe("number");
  });

  it("对缺失的订阅与取消订阅目标返回 not_found", async () => {
    const missingJwId = 2_147_483_647;
    const subscribeResult = await subscriber.client.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("workspace_subscription_add", {
      jwId: missingJwId,
      locale: "zh-cn",
    });
    const unsubscribeResult = await subscriber.client.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("workspace_subscription_remove", {
      jwId: missingJwId,
      locale: "zh-cn",
    });

    expect(subscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
    expect(unsubscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
  });
});

// --- formerly mcp-18-calendar-subscriptions ---
// Uses an isolated user: these tests replace the subscription set wholesale,
// which would race other files against the shared dev-seed user.
const context = fixtures.createSubscribedIsolatedMcpToolTestContext({
  emailPrefix: "mcp-calendar-subscriptions",
  name: "MCP Calendar Subscriptions",
});

describe("个人日历订阅 — 读取与批量订阅", () => {
  it("workspace_calendar_feed_get 返回订阅班级与个人 iCal 地址", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection(context.userId);

    const result = await context.client.call<{
      success?: boolean;
      subscription?: {
        userId?: string;
        sectionCount?: number;
        currentSemesterSectionCount?: number;
        currentSemesterSections?: unknown[];
        sections?: Array<{
          jwId?: number | null;
          code?: string | null;
        }>;
        calendarPath?: string | null;
        calendarUrl?: string | null;
        note?: string;
      };
    }>("workspace_calendar_feed_get", {
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(result.subscription?.userId).toBe(context.userId);
    expect(typeof result.subscription?.sectionCount).toBe("number");
    expect(typeof result.subscription?.currentSemesterSectionCount).toBe(
      "number",
    );
    expect(Array.isArray(result.subscription?.currentSemesterSections)).toBe(
      true,
    );
    expect(
      result.subscription?.sections?.some(
        (section) => section.jwId === fixtures.DEV_SEED.section.jwId,
      ),
    ).toBe(true);
    expect(result.subscription?.calendarPath).toMatch(
      /\/api\/calendar-feeds\/[^/]+\.ics$/,
    );
    expect(result.subscription?.calendarUrl).toContain(
      result.subscription?.calendarPath ?? "",
    );
    expect(result.subscription?.note).toContain("not official");
  });

  it("workspace_calendar_feed_get summary 兼容输入返回 default 结构", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection(context.userId);

    const result = await context.client.call<{
      success?: boolean;
      subscription?: {
        userId?: string;
        sectionCount?: number;
        currentSemesterSectionCount?: number;
        calendarPath?: string | null;
        calendarUrl?: string | null;
        currentSemesterSections?: unknown[];
      };
    }>("workspace_calendar_feed_get", {
      locale: "zh-cn",
      mode: "summary",
    });

    expect(result.success).toBe(true);
    expect(typeof result.subscription?.sectionCount).toBe("number");
    expect(typeof result.subscription?.currentSemesterSectionCount).toBe(
      "number",
    );
    expect(result.subscription?.calendarPath).toBeTruthy();
    expect(Array.isArray(result.subscription?.currentSemesterSections)).toBe(
      true,
    );
  });

  it("workspace_subscription_list 列出当前订阅班级", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection(context.userId);

    const result = await context.client.call<{
      success?: boolean;
      sections?: Array<{
        jwId?: number | null;
        code?: string | null;
        course?: { namePrimary?: string | null } | null;
      }>;
      note?: string;
    }>("workspace_subscription_list", {
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(
      result.sections?.some(
        (section) => section.jwId === fixtures.DEV_SEED.section.jwId,
      ),
    ).toBe(true);
    expect(result.note).toContain("not official");
  });

  it("catalog_section_calendar_feed_get 按 jwId 返回单班 iCal 信息", async () => {
    const result = await context.client.call<{
      found?: boolean;
      section?: {
        jwId?: number | null;
        code?: string | null;
      } | null;
      calendarPath?: string;
      calendarUrl?: string;
    }>("catalog_section_calendar_feed_get", {
      jwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.found).toBe(true);
    expect(result.section?.jwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect(result.section?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(result.calendarPath).toBe(
      `/api/catalog/sections/${fixtures.DEV_SEED.section.jwId}/calendar.ics`,
    );
    expect(result.calendarUrl).toContain(result.calendarPath ?? "");
  });

  it("catalog_section_calendar_feed_get 对缺失 jwId 返回 found=false", async () => {
    const missingJwId = 2_147_483_647;
    const result = await context.client.call<{
      found?: boolean;
      section?: unknown;
      calendarPath?: string;
      calendarUrl?: string;
    }>("catalog_section_calendar_feed_get", {
      jwId: missingJwId,
      locale: "zh-cn",
    });

    expect(result.found).toBe(false);
    expect(result.section).toBeNull();
    expect(result.calendarPath).toBe(
      `/api/catalog/sections/${missingJwId}/calendar.ics`,
    );
  });

  it("workspace_subscription_import 批量匹配并订阅班级", async () => {
    await fixtures.replaceUserSubscribedSections(context.userId, []);

    const result = await context.client.call<{
      success?: boolean;
      semester?: {
        id?: number;
        nameCn?: string | null;
        code?: string | null;
      } | null;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      addedCount?: number;
      alreadySubscribedCount?: number;
      subscription?: {
        sections?: unknown[];
        sectionCount?: number;
      } | null;
    }>("workspace_subscription_import", {
      codes: [fixtures.DEV_SEED.section.code],
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.unmatchedCodes).toEqual([]);
    expect(result.addedCount).toBeGreaterThanOrEqual(1);
    expect(result.alreadySubscribedCount).toBe(0);
    expect(
      (result.subscription?.sections?.length ??
        result.subscription?.sectionCount ??
        0) > 0,
    ).toBe(true);
  });

  it("workspace_subscription_import 跳过已订阅班级", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection(context.userId);

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      addedCount?: number;
      alreadySubscribedCount?: number;
    }>("workspace_subscription_import", {
      codes: [fixtures.DEV_SEED.section.code],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.addedCount).toBe(0);
    expect(result.alreadySubscribedCount).toBeGreaterThanOrEqual(1);
  });

  it("workspace_subscription_import 报告未匹配代码", async () => {
    const marker = `MISSING${Date.now()}.01`;

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      addedCount?: number;
      alreadySubscribedCount?: number;
    }>("workspace_subscription_import", {
      codes: [marker],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toEqual([]);
    expect(result.unmatchedCodes).toContain(marker);
    expect(result.addedCount).toBe(0);
    expect(result.alreadySubscribedCount).toBe(0);
  });

  it("workspace_subscription_import 对不存在的学期返回失败", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("workspace_subscription_import", {
      codes: [fixtures.DEV_SEED.section.code],
      semesterId: 2_147_483_647,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No semester found");
  });

  it("workspace_subscription_import 拒绝空代码列表", async () => {
    await expect(
      context.client.call("workspace_subscription_import", {
        codes: [],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });

  it("workspace_calendar_feed_get 对不存在用户返回失败", async () => {
    const missingUserMcp = await createMcpHarness("missing-user-id");
    try {
      const result = await missingUserMcp.call<{
        success?: boolean;
        message?: string;
      }>("workspace_calendar_feed_get", {
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("User not found");
    } finally {
      await missingUserMcp.close();
    }
  });
});
