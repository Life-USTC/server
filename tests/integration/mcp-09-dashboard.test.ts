import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("get_my_dashboard — 默认模式紧凑性", () => {
  let originalSubscriptionSectionIds: number[] = [];

  beforeAll(async () => {
    originalSubscriptionSectionIds = await fixtures.getUserSubscribedSectionIds(
      context.devUserId,
    );
    await fixtures.ensureDevUserSubscribedToSeedSection(context.devUserId);
  });

  afterAll(async () => {
    await fixtures.replaceUserSubscribedSections(
      context.devUserId,
      originalSubscriptionSectionIds,
    );
  });

  it("atTime 锚定下一节课、截止日期和事件", async () => {
    const dashboard = await context.client.call<{
      nextClass?: { type?: string; at?: string | null };
      upcomingDeadlines?: {
        total?: number;
        items?: Array<{ type?: string; at?: string | null }>;
      };
      upcomingEvents?: { total?: number };
    }>("get_my_dashboard", {
      locale: "zh-cn",
      mode: "summary",
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(dashboard.nextClass?.type).toBe("schedule");
    expect(dashboard.nextClass?.at?.slice(0, 10)).toBe(fixtures.SEED_DATE);
    expect(dashboard.upcomingDeadlines?.total).toBeGreaterThan(0);
    expect(dashboard.upcomingEvents?.total).toBeGreaterThan(0);
  });

  it("nextClass payload 中移除 scheduleGroup 和 roomType", async () => {
    const dashboard = await context.client.call<{
      nextClass?: {
        payload?: {
          scheduleGroup?: unknown;
          roomType?: unknown;
          date?: string;
          weekday?: number;
        };
      };
      subscriptions?: { currentSemesterSectionsTotal?: number };
      todos?: { incompleteCount?: number };
    }>("get_my_dashboard", { locale: "zh-cn", atTime: fixtures.SEED_AT_TIME });

    if (dashboard.nextClass?.payload) {
      expect(dashboard.nextClass.payload).not.toHaveProperty("scheduleGroup");
      expect(dashboard.nextClass.payload).not.toHaveProperty("roomType");
    }
    expect(typeof dashboard.subscriptions?.currentSemesterSectionsTotal).toBe(
      "number",
    );
    expect(typeof dashboard.todos?.incompleteCount).toBe("number");
  });

  it("summary 兼容输入与 default 返回相同结构", async () => {
    const def = await context.client.callTool("get_my_dashboard", {
      locale: "zh-cn",
      mode: "default",
      atTime: fixtures.SEED_AT_TIME,
    });
    const sum = await context.client.callTool("get_my_dashboard", {
      locale: "zh-cn",
      mode: "summary",
      atTime: fixtures.SEED_AT_TIME,
    });
    expect(sum).toEqual(def);
  });

  it("full 模式保留 default 的容器类型与合成键", async () => {
    const full = await context.client.call<{
      subscriptions?: {
        currentSemesterSections?: unknown[];
        currentSemesterSectionsTotal?: number;
      };
      upcomingDeadlines?: { total?: number; items?: unknown[] };
      upcomingEvents?: { total?: number; items?: unknown[] };
      bus?: { hasPreference?: boolean; departures?: unknown[] };
    }>("get_my_dashboard", {
      locale: "zh-cn",
      mode: "full",
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(Array.isArray(full.upcomingDeadlines?.items)).toBe(true);
    expect(Array.isArray(full.upcomingEvents?.items)).toBe(true);
    expect(typeof full.upcomingDeadlines?.total).toBe("number");
    expect(typeof full.upcomingEvents?.total).toBe("number");
    expect(Array.isArray(full.subscriptions?.currentSemesterSections)).toBe(
      true,
    );
    expect(typeof full.subscriptions?.currentSemesterSectionsTotal).toBe(
      "number",
    );
    expect(typeof full.bus?.hasPreference).toBe("boolean");
    expect(Array.isArray(full.bus?.departures)).toBe(true);
  });

  it("当前学期无关注班级时仍可按学期回溯往期数据", async () => {
    const subscribedBeforeTest = await fixtures.getUserSubscribedSectionIds(
      context.devUserId,
    );
    const previousSection = await fixtures.prisma.section.findUniqueOrThrow({
      where: { jwId: fixtures.DEV_SEED.previousSection.jwId },
    });

    await fixtures.replaceUserSubscribedSections(context.devUserId, [
      previousSection.id,
    ]);

    try {
      const dashboard = await context.client.call<{
        subscriptions?: {
          totalCount?: number;
          currentSemesterCount?: number;
        };
      }>("get_my_dashboard", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
      });
      expect(dashboard.subscriptions).toMatchObject({
        totalCount: 1,
        currentSemesterCount: 0,
      });

      const sections = await context.client.call<{
        sections?: Array<{ id?: number }>;
      }>("list_my_subscribed_sections", { locale: "zh-cn" });
      expect(sections.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: previousSection.id }),
        ]),
      );

      const homeworks = await context.client.call<{
        homeworks?: Array<{ title?: string }>;
      }>("list_my_homeworks", {
        locale: "zh-cn",
      });
      expect(homeworks.homeworks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: fixtures.DEV_SEED.homeworks.historicalTitle,
          }),
        ]),
      );

      const schedules = await context.client.call<{
        schedules?: Array<{ section?: { id?: number } }>;
      }>("list_my_schedules", {
        locale: "zh-cn",
      });
      expect(schedules.schedules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.objectContaining({ id: previousSection.id }),
          }),
        ]),
      );

      const exams = await context.client.call<{
        exams?: Array<{ section?: { id?: number } }>;
      }>("list_my_exams", { locale: "zh-cn" });
      expect(exams.exams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.objectContaining({ id: previousSection.id }),
          }),
        ]),
      );
    } finally {
      await fixtures.replaceUserSubscribedSections(
        context.devUserId,
        subscribedBeforeTest,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Dashboard link tools — list/search and pin state
// ---------------------------------------------------------------------------
