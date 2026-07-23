import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("flexDateInputSchema — 日期筛选工具接受裸 YYYY-MM-DD", () => {
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

  it("workspace_schedule_list 接受裸日期字符串（无时区偏移）", async () => {
    const result = await context.client.call<{
      schedules?: Array<{
        id?: number;
        date?: string;
        endTime?: unknown;
        startTime?: unknown;
      }>;
    }>("workspace_schedule_list", {
      dateFrom: fixtures.SEED_DATE, // bare date — would have been rejected by old dateTimeSchema
      dateTo: fixtures.SEED_PLUS_ELEVEN_DAYS,
      limit: 20,
      locale: "zh-cn",
    });

    // Should not error, and the seeded schedules should be returned
    expect(Array.isArray(result.schedules)).toBe(true);
    expect((result.schedules?.length ?? 0) > 0).toBe(true);
    expect(typeof result.schedules?.[0]?.startTime).toBe("string");
    expect(typeof result.schedules?.[0]?.endTime).toBe("string");
    // Every date should fall within the requested window
    for (const schedule of result.schedules ?? []) {
      if (schedule.date) {
        expect(schedule.date >= fixtures.SEED_DATE).toBe(true);
        expect(schedule.date <= fixtures.SEED_PLUS_TWELVE_DAYS).toBe(true); // lte dateTo end-of-day
      }
    }
  });

  it("workspace_exam_list 接受裸日期字符串", async () => {
    const result = await context.client.call<{
      exams?: Array<{ id?: number }>;
    }>("workspace_exam_list", {
      dateFrom: fixtures.SEED_DATE,
      includeDateUnknown: false,
      limit: 20,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.exams)).toBe(true);
  });

  it("workspace_calendar_event_list 接受裸日期字符串", async () => {
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("workspace_calendar_event_list", {
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_PLUS_ELEVEN_DAYS,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    // Should include the seeded schedule events
    expect(
      (result.events ?? []).some((e) =>
        ["schedule", "homework_due", "exam", "todo_due"].includes(e.type ?? ""),
      ),
    ).toBe(true);
  });

  it("workspace_calendar_event_list 将同日裸日期范围视为完整上海天时区日", async () => {
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("workspace_calendar_event_list", {
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_DATE,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    expect(
      (result.events ?? []).some(
        (event) =>
          event.type === "schedule" && event.at?.startsWith(fixtures.SEED_DATE),
      ),
    ).toBe(true);
  });

  it("workspace_calendar_event_list 遵守精确包含的 dateTo 边界", async () => {
    const dueAt = `${fixtures.SEED_PLUS_THREE_DAYS}T21:00:00+08:00`;
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("workspace_calendar_event_list", {
      dateFrom: dueAt,
      dateTo: dueAt,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) => event.type === "homework_due" && event.at === dueAt,
      ),
    ).toBe(true);
  });

  it("workspace_calendar_event_list 在精确包含的 dateTo 边界包含 todo", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:45:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: context.devUserId,
        title: "[integration-test] inclusive todo dueAt",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        events?: Array<{
          type?: string;
          at?: string;
          payload?: { id?: string };
        }>;
      }>("workspace_calendar_event_list", {
        dateFrom: dueAt,
        dateTo: dueAt,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "todo_due" &&
            event.at === dueAt &&
            event.payload?.id === todo.id,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("workspace_calendar_event_list 包含与精确窗口重叠的定时事件", async () => {
    const schedule = await fixtures.prisma.schedule.findFirst({
      where: {
        section: { jwId: fixtures.DEV_SEED.section.jwId },
        date: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
      },
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });
    if (!schedule) {
      throw new Error(`Seed schedule for ${fixtures.SEED_DATE} not found`);
    }

    const windowStart = fixtures.shanghaiIsoOnSeedDate(schedule.startTime, 15);
    const windowEnd = fixtures.shanghaiIsoOnSeedDate(schedule.startTime, 30);
    const endsAt = new Date(fixtures.shanghaiIsoOnSeedDate(schedule.endTime));
    expect(endsAt.getTime()).toBeGreaterThan(new Date(windowEnd).getTime());

    const result = await context.client.call<{
      events?: Array<{ type?: string; payload?: { id?: number } }>;
    }>("workspace_calendar_event_list", {
      dateFrom: windowStart,
      dateTo: windowEnd,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) =>
          event.type === "schedule" && event.payload?.id === schedule.id,
      ),
    ).toBe(true);
  });

  it("workspace_calendar_event_list 为精确窗口放宽基于日期的查询", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042901;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("workspace_calendar_event_list", {
        dateFrom: `${fixtures.SEED_DATE}T00:10:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T00:30:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("workspace_calendar_event_list 使无时间考试在当天保持可见", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042900;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; at?: string }>;
      }>("workspace_calendar_event_list", {
        dateFrom: `${fixtures.SEED_DATE}T08:00:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T09:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "exam" &&
            event.at === `${fixtures.SEED_DATE}T00:00:00+08:00`,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("workspace_calendar_event_list 对无 startTime 的考试尊重 endTime", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042902;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: 1200,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("workspace_calendar_event_list", {
        dateFrom: `${fixtures.SEED_DATE}T13:00:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T14:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(false);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("对无效日期字符串返回描述性错误", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("workspace_schedule_list", {
      dateFrom: "not-a-date",
      limit: 5,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not-a-date");
    expect(result.message?.toLowerCase()).toContain("invalid");
  });
});

// ---------------------------------------------------------------------------
// atTime override — reproducible time-sensitive tools
// ---------------------------------------------------------------------------
