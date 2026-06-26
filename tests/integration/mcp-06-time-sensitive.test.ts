import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("atTime override — time-sensitive tools are anchored to SEED_DATE", () => {
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

  it("get_my_7days_timeline with atTime returns the seed window and correct range", async () => {
    const result = await context.client.call<{
      range?: { from?: string; to?: string };
      total?: number;
      events?: Array<{ type?: string; at?: string }>;
    }>("get_my_7days_timeline", {
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

  it("get_my_7days_timeline summary mode with atTime returns grouped collection", async () => {
    const result = await context.client.call<{
      total?: number;
      events?: {
        total?: number;
        byType?: { schedule?: number; homework_due?: number };
        days?: Array<{ date?: string; total?: number }>;
        items?: Array<{ type?: string }>;
      };
    }>("get_my_7days_timeline", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
      mode: "summary",
    });

    expect(result.events?.total).toBe(result.total);
    expect(typeof result.events?.byType?.schedule).toBe("number");
    expect(result.events?.byType?.schedule).toBeGreaterThan(0);
    expect((result.events?.days?.length ?? 0) > 0).toBe(true);
    // Days should fall within the seed window
    for (const day of result.events?.days ?? []) {
      expect(day.date).toMatch(/^2026-0[45]/);
    }
  });

  it("get_upcoming_deadlines with atTime only returns events after the anchor", async () => {
    const result = await context.client.call<{
      total?: number;
      deadlines?: Array<{ type?: string; at?: string }>;
    }>("get_upcoming_deadlines", {
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

  it("get_upcoming_deadlines excludes already-started exams", async () => {
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
      }>("get_upcoming_deadlines", {
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

  it("get_upcoming_deadlines treats date-only atTime as Shanghai day start", async () => {
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
      }>("get_upcoming_deadlines", {
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

  it("get_my_overview with atTime reflects the seed day's schedule count and sample limit", async () => {
    const result = await context.client.call<{
      overview?: {
        pendingTodosCount?: number;
        todaySchedulesCount?: number;
        upcomingExamsCount?: number;
      };
      samples?: { dueTodos?: Array<{ dueAt?: string | null }> };
    }>("get_my_overview", {
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
        dueTodos?: { total?: number; items?: Array<{ id?: string }> };
      };
    }>("get_my_overview", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
      mode: "summary",
    });
    expect(summary.samples?.dueTodos?.total ?? 0).toBeGreaterThanOrEqual(
      summary.samples?.dueTodos?.items?.length ?? 0,
    );
    expect((summary.samples?.dueTodos?.items?.length ?? 0) <= 3).toBe(true);
  });

  it("get_my_overview treats date-only atTime as Shanghai day start", async () => {
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
      }>("get_my_overview", {
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

  it("get_my_overview honors the compact overview homework window", async () => {
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
      }>("get_my_overview", {
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
      }>("get_my_overview", {
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

  it("get_my_overview summary mode stays smaller after all due samples pass", async () => {
    const atTime = `${fixtures.SEED_PLUS_TWELVE_DAYS}T12:00:00+08:00`;
    const defaultPayload = await context.client.callTool("get_my_overview", {
      locale: "zh-cn",
      atTime,
    });
    const summaryPayload = (await context.client.callTool("get_my_overview", {
      locale: "zh-cn",
      atTime,
      mode: "summary",
    })) as {
      samples?: {
        dueTodos?: { total?: number; items?: unknown[] };
        dueHomeworks?: { total?: number; items?: unknown[] };
        upcomingExams?: { total?: number; items?: unknown[] };
      };
    };

    expect(JSON.stringify(summaryPayload, null, 2).length).toBeLessThan(
      JSON.stringify(defaultPayload, null, 2).length,
    );
    expect(typeof summaryPayload.samples?.dueTodos?.total).toBe("number");
    expect(summaryPayload.samples?.dueTodos?.items).toBeUndefined();
    expect(summaryPayload.samples?.dueHomeworks?.items).toBeUndefined();
    expect(summaryPayload.samples?.upcomingExams?.items).toBeUndefined();
  });

  it("get_my_overview excludes same-day exams that already ended", async () => {
    const atTime = `${fixtures.SEED_DATE}T12:00:00+08:00`;
    const before = await context.client.call<{
      overview?: { upcomingExamsCount?: number };
    }>("get_my_overview", {
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
      }>("get_my_overview", {
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

  it("get_my_overview excludes date-unknown exams from upcoming counts", async () => {
    const before = await context.client.call<{
      overview?: { upcomingExamsCount?: number };
    }>("get_my_overview", {
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
      }>("get_my_overview", {
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
// list_schedules_by_section — new date filter
// ---------------------------------------------------------------------------
