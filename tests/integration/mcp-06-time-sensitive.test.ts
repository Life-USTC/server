import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("atTime 覆盖 — 时间敏感工具锚定到 SEED_DATE", () => {
  let originalSubscriptionSectionIds: number[] = [];
  let seedSectionId = 0;

  beforeAll(async () => {
    originalSubscriptionSectionIds = await fixtures.getUserSubscribedSectionIds(
      context.devUserId,
    );
    seedSectionId = await fixtures.ensureDevUserSubscribedToSeedSection(
      context.devUserId,
    );
  });

  afterAll(async () => {
    await fixtures.replaceUserSubscribedSections(
      context.devUserId,
      originalSubscriptionSectionIds,
    );
  });

  it("workspace_calendar_timeline_get 使用 atTime 返回种子窗口和正确范围", async () => {
    const result = await context.client.call<{
      range?: { from?: string; to?: string };
      total?: number;
      events?: Array<{ type?: string; at?: string }>;
    }>("workspace_calendar_timeline_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
    });

    // Range anchored to seed date
    expect(result.range?.from).toMatch(new RegExp(`^${fixtures.SEED_DATE}`));
    expect(result.range?.to).toMatch(
      new RegExp(`^${fixtures.SEED_PLUS_SEVEN_DAYS}`),
    );
    expect(typeof result.total).toBe("number");
    expect(Array.isArray(result.events)).toBe(true);

    // Seeded schedules and homework deadlines must appear in this window
    expect((result.total ?? 0) > 0).toBe(true);
    expect((result.events ?? []).some((e) => e.type === "schedule")).toBe(true);
  });

  it("workspace_calendar_timeline_get summary 兼容输入保持 default 数组结构", async () => {
    const result = await context.client.call<{
      total?: number;
      events?: Array<{ type?: string; at?: string }>;
    }>("workspace_calendar_timeline_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
      mode: "summary",
    });

    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events).toHaveLength(result.total ?? 0);
    expect(result.events?.some((event) => event.type === "schedule")).toBe(
      true,
    );
  });

  it("workspace_deadline_list 使用 atTime 仅返回锚点之后的事件", async () => {
    const result = await context.client.call<{
      total?: number;
      deadlines?: Array<{ type?: string; at?: string }>;
    }>("workspace_deadline_list", {
      locale: "zh-cn",
      dayLimit: 14,
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(typeof result.total).toBe("number");
    expect(
      (result.deadlines ?? []).every((d) =>
        ["homework_due", "exam", "todo_due"].includes(d.type ?? ""),
      ),
    ).toBe(true);
    // All deadlines must be on or after the anchor date
    for (const deadline of result.deadlines ?? []) {
      if (deadline.at) {
        expect(deadline.at >= fixtures.SEED_DATE).toBe(true);
      }
    }
  });

  it("workspace_deadline_list 排除已开始考试", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042903;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: 900,
          endTime: 1100,
        },
      });

      const result = await context.client.call<{
        deadlines?: Array<{
          type?: string;
          payload?: { jwId?: number | null };
        }>;
      }>("workspace_deadline_list", {
        locale: "zh-cn",
        dayLimit: 1,
        atTime: fixtures.shanghaiIsoOnSeedDate(1000),
      });

      expect(
        (result.deadlines ?? []).some(
          (deadline) =>
            deadline.type === "exam" && deadline.payload?.jwId === jwId,
        ),
      ).toBe(false);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("workspace_deadline_list 将仅日期 atTime 视为上海天开始", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:30:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: context.devUserId,
        title: "[integration-test] early date-only deadline",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        deadlines?: Array<{
          type?: string;
          at?: string;
          payload?: { id?: string };
        }>;
      }>("workspace_deadline_list", {
        locale: "zh-cn",
        dayLimit: 1,
        atTime: fixtures.SEED_DATE,
      });

      expect(
        (result.deadlines ?? []).some(
          (deadline) =>
            deadline.type === "todo_due" &&
            deadline.at === dueAt &&
            deadline.payload?.id === todo.id,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("workspace_overview_get 使用 atTime 反映种子日课程数及样本限制", async () => {
    const result = await context.client.call<{
      overview?: {
        pendingTodosCount?: number;
        todaySchedulesCount?: number;
        upcomingExamsCount?: number;
      };
      samples?: { dueTodos?: Array<{ dueAt?: string | null }> };
    }>("workspace_overview_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
      limit: 2,
      mode: "full",
    });

    expect(typeof result.overview?.pendingTodosCount).toBe("number");
    // The seed day has seeded schedules so today's count should be > 0
    expect((result.overview?.todaySchedulesCount ?? 0) > 0).toBe(true);
    expect(typeof result.overview?.upcomingExamsCount).toBe("number");
    expect((result.samples?.dueTodos?.length ?? 0) > 0).toBe(true);
    expect((result.samples?.dueTodos?.length ?? 0) <= 2).toBe(true);
    expect(
      result.samples?.dueTodos?.every((todo) => typeof todo.dueAt === "string"),
    ).toBe(true);

    const summary = await context.client.call<{
      samples?: {
        dueTodos?: Array<{ id?: string }>;
      };
    }>("workspace_overview_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
      mode: "summary",
    });
    expect(Array.isArray(summary.samples?.dueTodos)).toBe(true);
  });

  it("workspace_overview_get 将仅日期 atTime 视为上海天开始", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:30:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: context.devUserId,
        title: "[integration-test] early date-only overview todo",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        samples?: { dueTodos?: Array<{ dueAt?: string; id?: string }> };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_DATE,
        limit: 30,
        mode: "full",
      });

      expect(
        result.samples?.dueTodos?.some(
          (item) => item.id === todo.id && item.dueAt === dueAt,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("workspace_overview_get 遵守紧凑总览作业窗口", async () => {
    const title = `[integration-test] outside overview window ${Date.now()}`;
    const homework = await fixtures.prisma.homework.create({
      data: {
        createdById: context.devUserId,
        isMajor: false,
        requiresTeam: false,
        sectionId: seedSectionId,
        submissionDueAt: new Date(
          `${fixtures.SEED_PLUS_SEVEN_DAYS}T09:00:00+08:00`,
        ),
        title,
        updatedById: context.devUserId,
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        samples?: { dueHomeworks?: Array<{ id?: string; title?: string }> };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
        mode: "full",
      });

      expect(
        result.samples?.dueHomeworks?.some(
          (sample) => sample.id === homework.id || sample.title === title,
        ),
      ).toBe(false);

      const extendedWindowResult = await context.client.call<{
        samples?: { dueHomeworks?: Array<{ id?: string; title?: string }> };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
        homeworkWindowDays: 14,
        limit: 50,
        mode: "full",
      });

      expect(
        extendedWindowResult.samples?.dueHomeworks?.some(
          (sample) => sample.id === homework.id || sample.title === title,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.homework.deleteMany({ where: { id: homework.id } });
    }
  });

  it("workspace_overview_get summary 兼容输入与 default 结构和值一致", async () => {
    const atTime = `${fixtures.SEED_PLUS_TWELVE_DAYS}T12:00:00+08:00`;
    const defaultPayload = await context.client.callTool(
      "workspace_overview_get",
      {
        locale: "zh-cn",
        atTime,
      },
    );
    const summaryPayload = await context.client.callTool(
      "workspace_overview_get",
      {
        locale: "zh-cn",
        atTime,
        mode: "summary",
      },
    );

    expect(summaryPayload).toEqual(defaultPayload);
  });

  it("workspace_overview_get 排除当天已结束的考试", async () => {
    const atTime = `${fixtures.SEED_DATE}T12:00:00+08:00`;
    const before = await context.client.call<{
      overview?: { upcomingExamsCount?: number };
    }>("workspace_overview_get", {
      locale: "zh-cn",
      atTime,
    });

    const section = await fixtures.prisma.section.findUniqueOrThrow({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    await fixtures.prisma.exam.upsert({
      where: { jwId: fixtures.PAST_SAME_DAY_EXAM_JW_ID },
      update: {
        examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
        endTime: 1000,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
      create: {
        jwId: fixtures.PAST_SAME_DAY_EXAM_JW_ID,
        examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
        endTime: 1000,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
    });

    try {
      const result = await context.client.call<{
        overview?: { upcomingExamsCount?: number };
        samples?: { upcomingExams?: Array<{ jwId?: number }> };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime,
      });

      expect(result.overview?.upcomingExamsCount).toBe(
        before.overview?.upcomingExamsCount,
      );
      expect(
        result.samples?.upcomingExams?.some(
          (exam) => exam.jwId === fixtures.PAST_SAME_DAY_EXAM_JW_ID,
        ),
      ).toBe(false);
    } finally {
      await fixtures.prisma.exam.deleteMany({
        where: { jwId: fixtures.PAST_SAME_DAY_EXAM_JW_ID },
      });
    }
  });

  it("workspace_overview_get 从未知日期考试中排除待考计数", async () => {
    const before = await context.client.call<{
      overview?: { upcomingExamsCount?: number };
    }>("workspace_overview_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
    });

    const section = await fixtures.prisma.section.findUniqueOrThrow({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    await fixtures.prisma.exam.upsert({
      where: { jwId: fixtures.UNKNOWN_DATE_EXAM_JW_ID },
      update: {
        endTime: 1000,
        examDate: null,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
      create: {
        jwId: fixtures.UNKNOWN_DATE_EXAM_JW_ID,
        endTime: 1000,
        examDate: null,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
    });

    try {
      const result = await context.client.call<{
        overview?: { upcomingExamsCount?: number };
        samples?: { upcomingExams?: Array<{ jwId?: number }> };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
        limit: 30,
      });

      expect(result.overview?.upcomingExamsCount).toBe(
        before.overview?.upcomingExamsCount,
      );
      expect(
        result.samples?.upcomingExams?.some(
          (exam) => exam.jwId === fixtures.UNKNOWN_DATE_EXAM_JW_ID,
        ),
      ).toBe(false);
    } finally {
      await fixtures.prisma.exam.deleteMany({
        where: { jwId: fixtures.UNKNOWN_DATE_EXAM_JW_ID },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// catalog_section_schedule_list — new date filter
// ---------------------------------------------------------------------------
