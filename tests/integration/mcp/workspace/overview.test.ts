// Merged from mcp-06-time-sensitive + mcp-09-workspace

import { describe, expect, it } from "vitest";
import {
  assertOverviewCountsAreNumbers,
  assertOverviewSampleLimit,
  assertSeedDayOverviewScheduleCounts,
  normalizeMcpOverviewPayload,
} from "../../../shared/scenarios/overview";
import * as fixtures from "../_harness";

describe("atTime 覆盖 — 时间敏感工具锚定到 SEED_DATE", () => {
  const isolated = fixtures.createSubscribedIsolatedMcpToolTestContext({
    emailPrefix: "mcp-time-sensitive",
    name: "[integration-test] Time Sensitive Tools",
  });

  it("workspace_calendar_timeline_get 使用 atTime 返回种子窗口和正确范围", async () => {
    const result = await isolated.client.call<{
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
    const result = await isolated.client.call<{
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
    const result = await isolated.client.call<{
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
    await fixtures.deleteIntegrationExam(jwId);

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

      const result = await isolated.client.call<{
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
      await fixtures.deleteIntegrationExam(jwId);
    }
  });

  it("workspace_deadline_list 将仅日期 atTime 视为上海天开始", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:30:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: isolated.userId,
        title: "[integration-test] early date-only deadline",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await isolated.client.call<{
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
      await fixtures.deleteIntegrationTodo(todo.id);
    }
  });

  it("workspace_overview_get 使用 atTime 反映种子日课程数及样本限制", async () => {
    const dueAt = `${fixtures.SEED_DATE}T18:00:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: isolated.userId,
        title: "[integration-test] overview sample todo",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await isolated.client.call<{
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

      const snapshot = normalizeMcpOverviewPayload(result);
      assertOverviewCountsAreNumbers(snapshot);
      assertSeedDayOverviewScheduleCounts(snapshot);
      assertOverviewSampleLimit(snapshot, 2);
      expect((snapshot.dueTodosCount ?? 0) > 0).toBe(true);
      expect(
        result.samples?.dueTodos?.every(
          (todo) => typeof todo.dueAt === "string",
        ),
      ).toBe(true);

      const summary = await isolated.client.call<{
        samples?: {
          dueTodos?: Array<{ id?: string }>;
        };
      }>("workspace_overview_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
        mode: "summary",
      });
      expect(Array.isArray(summary.samples?.dueTodos)).toBe(true);
    } finally {
      await fixtures.deleteIntegrationTodo(todo.id);
    }
  });

  it("workspace_overview_get 将仅日期 atTime 视为上海天开始", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:30:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: isolated.userId,
        title: "[integration-test] early date-only overview todo",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await isolated.client.call<{
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
      await fixtures.deleteIntegrationTodo(todo.id);
    }
  });

  it("workspace_overview_get 遵守紧凑总览作业窗口", async () => {
    const title = `[integration-test] outside overview window ${Date.now()}`;
    const homework = await fixtures.prisma.homework.create({
      data: {
        createdById: isolated.userId,
        isMajor: false,
        requiresTeam: false,
        sectionId: isolated.seedSectionId,
        submissionDueAt: new Date(
          `${fixtures.SEED_PLUS_SEVEN_DAYS}T09:00:00+08:00`,
        ),
        title,
        updatedById: isolated.userId,
      },
      select: { id: true },
    });

    try {
      const result = await isolated.client.call<{
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

      const extendedWindowResult = await isolated.client.call<{
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
      await fixtures.deleteIntegrationHomework(homework.id);
    }
  });

  it("workspace_overview_get summary 兼容输入与 default 结构和值一致", async () => {
    const atTime = `${fixtures.SEED_PLUS_TWELVE_DAYS}T12:00:00+08:00`;
    const defaultPayload = await isolated.client.callTool(
      "workspace_overview_get",
      {
        locale: "zh-cn",
        atTime,
      },
    );
    const summaryPayload = await isolated.client.callTool(
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
    const before = await isolated.client.call<{
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
      const result = await isolated.client.call<{
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
      await fixtures.deleteIntegrationExam(fixtures.PAST_SAME_DAY_EXAM_JW_ID);
    }
  });

  it("workspace_overview_get 从未知日期考试中排除待考计数", async () => {
    const before = await isolated.client.call<{
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
      const result = await isolated.client.call<{
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
      await fixtures.deleteIntegrationExam(fixtures.UNKNOWN_DATE_EXAM_JW_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// catalog_section_schedule_list — new date filter
// ---------------------------------------------------------------------------

// --- formerly mcp-09-workspace ---
const isolated = fixtures.createSubscribedIsolatedMcpToolTestContext({
  emailPrefix: "mcp-workspace",
  name: "[integration-test] Workspace",
});

describe("workspace_snapshot_get — 默认模式紧凑性", () => {
  it("atTime 锚定下一节课、截止日期和事件", async () => {
    const workspaceResult = await isolated.client.call<{
      nextClass?: { type?: string; at?: string | null };
      upcomingDeadlines?: {
        total?: number;
        items?: Array<{ type?: string; at?: string | null }>;
      };
      upcomingEvents?: { total?: number };
    }>("workspace_snapshot_get", {
      locale: "zh-cn",
      mode: "summary",
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(workspaceResult.nextClass?.type).toBe("schedule");
    expect(workspaceResult.nextClass?.at?.slice(0, 10)).toBe(
      fixtures.SEED_DATE,
    );
    expect(workspaceResult.upcomingDeadlines?.total).toBeGreaterThan(0);
    expect(workspaceResult.upcomingEvents?.total).toBeGreaterThan(0);
  });

  it("nextClass payload 中移除 scheduleGroup 和 roomType", async () => {
    const workspaceResult = await isolated.client.call<{
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
    }>("workspace_snapshot_get", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
    });

    if (workspaceResult.nextClass?.payload) {
      expect(workspaceResult.nextClass.payload).not.toHaveProperty(
        "scheduleGroup",
      );
      expect(workspaceResult.nextClass.payload).not.toHaveProperty("roomType");
    }
    expect(
      typeof workspaceResult.subscriptions?.currentSemesterSectionsTotal,
    ).toBe("number");
    expect(typeof workspaceResult.todos?.incompleteCount).toBe("number");
  });

  it("summary 兼容输入与 default 返回相同结构", async () => {
    const def = await isolated.client.callTool("workspace_snapshot_get", {
      locale: "zh-cn",
      mode: "default",
      atTime: fixtures.SEED_AT_TIME,
    });
    const sum = await isolated.client.callTool("workspace_snapshot_get", {
      locale: "zh-cn",
      mode: "summary",
      atTime: fixtures.SEED_AT_TIME,
    });
    expect(sum).toEqual(def);
  });

  it("full 模式保留 default 的容器类型与合成键", async () => {
    const full = await isolated.client.call<{
      subscriptions?: {
        currentSemesterSections?: unknown[];
        currentSemesterSectionsTotal?: number;
      };
      upcomingDeadlines?: { total?: number; items?: unknown[] };
      upcomingEvents?: { total?: number; items?: unknown[] };
      bus?: { hasPreference?: boolean; departures?: unknown[] };
    }>("workspace_snapshot_get", {
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
    const previousSection = await fixtures.prisma.section.findUniqueOrThrow({
      where: { jwId: fixtures.DEV_SEED.previousSection.jwId },
    });
    const currentSectionId =
      await fixtures.ensureDevUserSubscribedToSeedSection(isolated.userId);

    await fixtures.replaceUserSubscribedSections(isolated.userId, [
      previousSection.id,
    ]);

    try {
      const workspaceResult = await isolated.client.call<{
        subscriptions?: {
          totalCount?: number;
          currentSemesterCount?: number;
        };
      }>("workspace_snapshot_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
      });
      expect(workspaceResult.subscriptions).toMatchObject({
        totalCount: 1,
        currentSemesterCount: 0,
      });

      const sections = await isolated.client.call<{
        sections?: Array<{ id?: number }>;
      }>("workspace_subscription_list", { locale: "zh-cn" });
      expect(sections.sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: previousSection.id }),
        ]),
      );

      const homeworks = await isolated.client.call<{
        homeworks?: Array<{ title?: string }>;
      }>("workspace_homework_list", {
        locale: "zh-cn",
      });
      expect(homeworks.homeworks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: fixtures.DEV_SEED.homeworks.historicalTitle,
          }),
        ]),
      );

      const schedules = await isolated.client.call<{
        schedules?: Array<{ section?: { id?: number } }>;
      }>("workspace_schedule_list", {
        locale: "zh-cn",
      });
      expect(schedules.schedules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.objectContaining({ id: previousSection.id }),
          }),
        ]),
      );

      const exams = await isolated.client.call<{
        exams?: Array<{ section?: { id?: number } }>;
      }>("workspace_exam_list", { locale: "zh-cn" });
      expect(exams.exams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.objectContaining({ id: previousSection.id }),
          }),
        ]),
      );
    } finally {
      await fixtures.replaceUserSubscribedSections(isolated.userId, [
        currentSectionId,
      ]);
    }
  });
});

describe("workspace_schedule_next — 聚焦下一节课", () => {
  it("atTime 锚定下一节课并与 snapshot 一致", async () => {
    const [snapshot, next] = await Promise.all([
      isolated.client.call<{
        nextClass?: { type?: string; at?: string | null };
      }>("workspace_snapshot_get", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
      }),
      isolated.client.call<{
        found?: boolean;
        nextClass?: { type?: string; at?: string | null };
        currentSemester?: { code?: string | null; nameCn?: string | null };
      }>("workspace_schedule_next", {
        locale: "zh-cn",
        atTime: fixtures.SEED_AT_TIME,
      }),
    ]);

    expect(next.found).toBe(true);
    expect(next.nextClass).toEqual(snapshot.nextClass);
    expect(next.nextClass?.type).toBe("schedule");
    expect(next.nextClass?.at?.slice(0, 10)).toBe(fixtures.SEED_DATE);
    expect(next.currentSemester?.code).toBeDefined();
  });

  it("default 模式紧凑化 nextClass payload", async () => {
    const next = await isolated.client.call<{
      found?: boolean;
      nextClass?: {
        payload?: {
          scheduleGroup?: unknown;
          roomType?: unknown;
        };
      };
    }>("workspace_schedule_next", {
      locale: "zh-cn",
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(next.found).toBe(true);
    if (next.nextClass?.payload) {
      expect(next.nextClass.payload).not.toHaveProperty("scheduleGroup");
      expect(next.nextClass.payload).not.toHaveProperty("roomType");
    }
  });
});
