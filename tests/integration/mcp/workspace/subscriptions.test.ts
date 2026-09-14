// Merged from mcp-12-subscriptions + mcp-18-calendar-subscriptions

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createFixturePrisma,
  disconnectTestPrisma,
} from "../../../shared/prisma";
import {
  assertSubscriptionAction,
  assertSubscriptionBrief,
} from "../../../shared/scenarios/subscriptions";
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

    assertSubscriptionAction(result, fixtures.DEV_SEED.section.jwId, [
      "subscribed",
      "already_subscribed",
    ]);
    assertSubscriptionBrief(result.subscription);
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
// Uses an isolated user: these tests arrange subscription state directly,
// which would race other files against the shared dev-seed user.
const context = fixtures.createSubscribedIsolatedMcpToolTestContext({
  emailPrefix: "mcp-calendar-subscriptions",
  name: "MCP Calendar Subscriptions",
});

const rlsFixturePrisma = createFixturePrisma();

describe("workspace subscriptions through the restricted MCP runtime", () => {
  let client: Awaited<ReturnType<typeof createMcpHarness>> | undefined;
  let userId = "";
  let otherUserId = "";
  let activeSectionId = 0;
  let activeSectionJwId = 0;
  let retiredSectionId = 0;
  let retiredSectionJwId = 0;
  let courseId = 0;
  let semesterId = 0;

  beforeAll(async () => {
    const suffix = crypto.randomUUID();
    // Keep custom catalog rows isolated from shared seed rows. The fixture
    // client is the function-owner connection; MCP itself uses DATABASE_URL.
    const numericMarker =
      2_000_000_000 +
      (Date.now() % 10_000_000) * 2 +
      Math.trunc(Math.random() * 1_000);
    const fixture = await rlsFixturePrisma.$transaction(async (tx) => {
      const semester = await tx.semester.create({
        data: {
          jwId: numericMarker,
          code: `[integration-test] mcp-rls-semester-${suffix}`,
          nameCn: `[integration-test] MCP RLS semester ${suffix}`,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2027-01-01T00:00:00.000Z"),
        },
        select: { id: true },
      });
      const course = await tx.course.create({
        data: {
          jwId: numericMarker + 1,
          code: `[integration-test] MCP-RLS-${suffix}`,
          nameCn: `[integration-test] MCP RLS course ${suffix}`,
        },
        select: { id: true },
      });
      const [activeSection, retiredSection] = await Promise.all([
        tx.section.create({
          data: {
            jwId: numericMarker + 2,
            code: `[integration-test] MCP-RLS-active-${suffix}`,
            courseId: course.id,
            semesterId: semester.id,
          },
          select: { id: true, jwId: true },
        }),
        tx.section.create({
          data: {
            jwId: numericMarker + 3,
            code: `[integration-test] MCP-RLS-retired-${suffix}`,
            courseId: course.id,
            semesterId: semester.id,
            retiredAt: new Date("2026-09-01T00:00:00.000Z"),
          },
          select: { id: true, jwId: true },
        }),
      ]);
      const user = await tx.user.create({
        data: {
          email: `integration-mcp-subscription-rls-${suffix}@example.test`,
          name: "MCP subscription RLS owner",
        },
        select: { id: true },
      });
      const otherUser = await tx.user.create({
        data: {
          email: `integration-mcp-subscription-rls-other-${suffix}@example.test`,
          name: "MCP subscription RLS other owner",
        },
        select: { id: true },
      });
      await tx.userSectionSubscription.create({
        data: {
          userId: otherUser.id,
          sectionId: activeSection.id,
          kind: "teaching_assistant",
        },
      });
      return {
        activeSection,
        courseId: course.id,
        otherUserId: otherUser.id,
        retiredSection,
        semesterId: semester.id,
        userId: user.id,
      };
    });

    activeSectionId = fixture.activeSection.id;
    activeSectionJwId = fixture.activeSection.jwId;
    courseId = fixture.courseId;
    otherUserId = fixture.otherUserId;
    retiredSectionId = fixture.retiredSection.id;
    retiredSectionJwId = fixture.retiredSection.jwId;
    semesterId = fixture.semesterId;
    userId = fixture.userId;
    client = await createMcpHarness(userId);
  });

  afterAll(async () => {
    await client?.close();
    await rlsFixturePrisma.$transaction(async (tx) => {
      await tx.user.deleteMany({
        where: { id: { in: [userId, otherUserId] } },
      });
      await tx.section.deleteMany({
        where: { id: { in: [activeSectionId, retiredSectionId] } },
      });
      await tx.course.deleteMany({ where: { id: courseId } });
      await tx.semester.deleteMany({ where: { id: semesterId } });
    });
    await disconnectTestPrisma(rlsFixturePrisma);
  });

  it("runs subscribe/list/remove/list under RLS and preserves other owners", async () => {
    if (!client) throw new Error("MCP fixture is not ready");

    const add = await client.call<{
      action?: string;
      sectionJwId?: number;
      success?: boolean;
      subscription?: {
        sections?: Array<{ jwId?: number; kind?: string }>;
      } | null;
    }>("workspace_subscription_add", {
      jwId: activeSectionJwId,
      locale: "zh-cn",
      mode: "full",
    });
    expect(add).toMatchObject({
      action: "subscribed",
      sectionJwId: activeSectionJwId,
      success: true,
      subscription: {
        sections: [
          expect.objectContaining({
            jwId: activeSectionJwId,
            kind: "regular",
          }),
        ],
      },
    });

    await rlsFixturePrisma.userSectionSubscription.create({
      data: {
        userId,
        sectionId: retiredSectionId,
        kind: "teaching_assistant",
      },
    });

    const listBeforeRemove = await client.call<{
      sections?: Array<{ jwId?: number; kind?: string }>;
      success?: boolean;
    }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
    expect(listBeforeRemove.success).toBe(true);
    expect(
      listBeforeRemove.sections
        ?.map(({ jwId, kind }) => ({ jwId, kind }))
        .sort((left, right) => (left.jwId ?? 0) - (right.jwId ?? 0)),
    ).toEqual([
      { jwId: activeSectionJwId, kind: "regular" },
      { jwId: retiredSectionJwId, kind: "teaching_assistant" },
    ]);

    const removeActive = await client.call<{
      action?: string;
      sectionJwId?: number;
      success?: boolean;
      subscription?: {
        sections?: Array<{ jwId?: number; kind?: string }>;
      } | null;
    }>("workspace_subscription_remove", {
      jwId: activeSectionJwId,
      locale: "zh-cn",
      mode: "full",
    });
    expect(removeActive).toMatchObject({
      action: "unsubscribed",
      sectionJwId: activeSectionJwId,
      success: true,
      subscription: {
        sections: [
          expect.objectContaining({
            jwId: retiredSectionJwId,
            kind: "teaching_assistant",
          }),
        ],
      },
    });

    const repeatedRemove = await client.call<{
      action?: string;
      sectionJwId?: number;
      success?: boolean;
    }>("workspace_subscription_remove", {
      jwId: activeSectionJwId,
      locale: "zh-cn",
      mode: "full",
    });
    expect(repeatedRemove).toMatchObject({
      action: "not_subscribed",
      sectionJwId: activeSectionJwId,
      success: true,
    });

    const listAfterActiveRemove = await client.call<{
      sections?: Array<{ jwId?: number; kind?: string }>;
    }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
    expect(
      listAfterActiveRemove.sections?.map(({ jwId, kind }) => ({
        jwId,
        kind,
      })),
    ).toEqual([{ jwId: retiredSectionJwId, kind: "teaching_assistant" }]);

    const removeRetired = await client.call<{
      action?: string;
      sectionJwId?: number;
      success?: boolean;
    }>("workspace_subscription_remove", {
      jwId: retiredSectionJwId,
      locale: "zh-cn",
      mode: "full",
    });
    expect(removeRetired).toMatchObject({
      action: "unsubscribed",
      sectionJwId: retiredSectionJwId,
      success: true,
    });

    const listAfterAllRemoves = await client.call<{
      sections?: unknown[];
    }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
    expect(listAfterAllRemoves.sections).toEqual([]);

    await expect(
      rlsFixturePrisma.userSectionSubscription.findMany({
        where: { userId },
      }),
    ).resolves.toEqual([]);
    await expect(
      rlsFixturePrisma.userSectionSubscription.findMany({
        where: { userId: otherUserId },
        select: { sectionId: true, kind: true },
      }),
    ).resolves.toEqual([
      { sectionId: activeSectionId, kind: "teaching_assistant" },
    ]);
  });
});

describe("个人日历订阅 — 读取与批量订阅", () => {
  it("workspace_calendar_feed_get 返回订阅班级但不泄露个人 iCal 凭据", async () => {
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
        calendarPath?: never;
        calendarUrl?: never;
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
    expect(result.subscription?.calendarPath).toBeUndefined();
    expect(result.subscription?.calendarUrl).toBeUndefined();
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
        calendarPath?: never;
        calendarUrl?: never;
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
    expect(result.subscription?.calendarPath).toBeUndefined();
    expect(result.subscription?.calendarUrl).toBeUndefined();
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
