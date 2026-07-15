import { describe, expect, it } from "vitest";
import { createMcpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("个人日历订阅 — 读取与批量订阅", () => {
  it("get_my_calendar_subscription 返回订阅班级与个人 iCal 地址", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection();

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
    }>("get_my_calendar_subscription", {
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(result.subscription?.userId).toBe(context.devUserId);
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
      /\/api\/users\/[^/]+\/calendar\.ics$/,
    );
    expect(result.subscription?.calendarUrl).toContain(
      result.subscription?.calendarPath ?? "",
    );
    expect(result.subscription?.note).toContain("not official");
  });

  it("get_my_calendar_subscription summary 兼容输入返回 default 结构", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection();

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
    }>("get_my_calendar_subscription", {
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

  it("list_my_subscribed_sections 列出当前订阅班级", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection();

    const result = await context.client.call<{
      success?: boolean;
      sections?: Array<{
        jwId?: number | null;
        code?: string | null;
        course?: { namePrimary?: string | null } | null;
      }>;
      note?: string;
    }>("list_my_subscribed_sections", {
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

  it("get_section_calendar_subscription 按 jwId 返回单班 iCal 信息", async () => {
    const result = await context.client.call<{
      found?: boolean;
      section?: {
        jwId?: number | null;
        code?: string | null;
      } | null;
      calendarPath?: string;
      calendarUrl?: string;
    }>("get_section_calendar_subscription", {
      jwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.found).toBe(true);
    expect(result.section?.jwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect(result.section?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(result.calendarPath).toBe(
      `/api/sections/${fixtures.DEV_SEED.section.jwId}/calendar.ics`,
    );
    expect(result.calendarUrl).toContain(result.calendarPath ?? "");
  });

  it("get_section_calendar_subscription 对缺失 jwId 返回 found=false", async () => {
    const missingJwId = 2_147_483_647;
    const result = await context.client.call<{
      found?: boolean;
      section?: unknown;
      calendarPath?: string;
      calendarUrl?: string;
    }>("get_section_calendar_subscription", {
      jwId: missingJwId,
      locale: "zh-cn",
    });

    expect(result.found).toBe(false);
    expect(result.section).toBeNull();
    expect(result.calendarPath).toBe(
      `/api/sections/${missingJwId}/calendar.ics`,
    );
  });

  it("subscribe_my_sections_by_codes 批量匹配并订阅班级", async () => {
    await fixtures.replaceUserSubscribedSections(context.devUserId, []);

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
    }>("subscribe_my_sections_by_codes", {
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

  it("subscribe_my_sections_by_codes 跳过已订阅班级", async () => {
    await fixtures.ensureDevUserSubscribedToSeedSection();

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      addedCount?: number;
      alreadySubscribedCount?: number;
    }>("subscribe_my_sections_by_codes", {
      codes: [fixtures.DEV_SEED.section.code],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.addedCount).toBe(0);
    expect(result.alreadySubscribedCount).toBeGreaterThanOrEqual(1);
  });

  it("subscribe_my_sections_by_codes 报告未匹配代码", async () => {
    const marker = `MISSING${Date.now()}.01`;

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      addedCount?: number;
      alreadySubscribedCount?: number;
    }>("subscribe_my_sections_by_codes", {
      codes: [marker],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toEqual([]);
    expect(result.unmatchedCodes).toContain(marker);
    expect(result.addedCount).toBe(0);
    expect(result.alreadySubscribedCount).toBe(0);
  });

  it("subscribe_my_sections_by_codes 对不存在的学期返回失败", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("subscribe_my_sections_by_codes", {
      codes: [fixtures.DEV_SEED.section.code],
      semesterId: 2_147_483_647,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No semester found");
  });

  it("subscribe_my_sections_by_codes 拒绝空代码列表", async () => {
    await expect(
      context.client.call("subscribe_my_sections_by_codes", {
        codes: [],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });

  it("get_my_calendar_subscription 对不存在用户返回失败", async () => {
    const missingUserMcp = await createMcpHarness("missing-user-id");
    try {
      const result = await missingUserMcp.call<{
        success?: boolean;
        message?: string;
      }>("get_my_calendar_subscription", {
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("User not found");
    } finally {
      await missingUserMcp.close();
    }
  });
});
