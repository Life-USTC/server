import { describe } from "vitest";
import {
  assertOverviewCountsAreNumbers,
  assertOverviewSampleLimit,
  assertSeedDayOverviewScheduleCounts,
  normalizeMcpOverviewPayload,
} from "../../../shared/scenarios/overview";
import { isolatedMcpTest } from "../_harness/isolated-context";
import {
  createPrivateMcpHistoricalOverview,
  createPrivateMcpOverview,
} from "../_harness/overview-fixture";

const overviewDate = "2026-04-29";
const overviewAtTime = "2026-04-29T08:00:00+08:00";
const overviewPlusSevenDays = "2026-05-06";
const overviewPlusTwelveDays = "2026-05-11";

const workspaceTest = isolatedMcpTest.extend(
  "isolated",
  async ({
    mcpWorkflow,
    signal,
    mcpActor,
    mcpSection,
    mcpSchedules,
    isolatedDatabase,
  }) => {
    const setupResult = await mcpWorkflow.run(async () => {
      const records = await createPrivateMcpOverview(
        isolatedDatabase.owner,
        mcpActor.userId,
        mcpSection.id,
      );
      return {
        ...mcpActor,
        sectionId: mcpSection.id,
        sectionJwId: mcpSection.jwId,
        schedules: mcpSchedules,
        ...records,
      };
    });
    signal.throwIfAborted();
    return setupResult;
  },
);

describe("atTime 覆盖 — 时间敏感工具锚定到 SEED_DATE", () => {
  const anchoredTimeTest = workspaceTest;

  anchoredTimeTest(
    "workspace_calendar_timeline_get 使用 atTime 返回种子窗口和正确范围",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          range?: { from?: string; to?: string };
          total?: number;
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: number | string };
          }>;
        }>("workspace_calendar_timeline_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
        });

        // Range anchored to seed date
        expect(result.range?.from).toMatch(new RegExp(`^${overviewDate}`));
        expect(result.range?.to).toMatch(
          new RegExp(`^${overviewPlusSevenDays}`),
        );
        expect(typeof result.total).toBe("number");
        expect(Array.isArray(result.events)).toBe(true);

        // Seeded schedules and homework deadlines must appear in this window
        expect((result.total ?? 0) > 0).toBe(true);
        expect((result.events ?? []).some((e) => e.type === "schedule")).toBe(
          true,
        );

        expect(
          result.events
            ?.filter((event) => event.type === "schedule")
            .map((event) => event.payload?.id),
        ).toEqual(isolated.schedules.slice(0, 2).map((row) => row.id));
        expect(result.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "homework_due",
              payload: expect.objectContaining({ id: isolated.homework.id }),
            }),
            expect.objectContaining({
              type: "exam",
              payload: expect.objectContaining({ id: isolated.exam.id }),
            }),
          ]),
        );
      }),
  );

  anchoredTimeTest(
    "workspace_calendar_timeline_get summary 兼容输入保持 default 数组结构",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          total?: number;
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: number | string };
          }>;
        }>("workspace_calendar_timeline_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
          mode: "default",
        });

        expect(Array.isArray(result.events)).toBe(true);
        expect(result.events).toHaveLength(result.total ?? 0);
        expect(result.events?.some((event) => event.type === "schedule")).toBe(
          true,
        );
      }),
  );

  anchoredTimeTest(
    "workspace_deadline_list 使用 atTime 仅返回锚点之后的事件",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          total?: number;
          deadlines?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: number | string };
          }>;
        }>("workspace_deadline_list", {
          locale: "zh-cn",
          dayLimit: 14,
          atTime: overviewAtTime,
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
            expect(deadline.at >= overviewDate).toBe(true);
          }
        }

        expect(
          result.deadlines?.map((deadline) => ({
            type: deadline.type,
            id: deadline.payload?.id,
          })),
        ).toEqual([
          { type: "exam", id: isolated.exam.id },
          { type: "homework_due", id: isolated.homework.id },
        ]);
      }),
  );

  anchoredTimeTest(
    "workspace_deadline_list 排除已开始考试",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const section = await db.section.findUnique({
          where: { jwId: isolated.sectionJwId },
          select: { id: true },
        });
        if (!section) {
          throw new Error(`Seed section ${isolated.sectionJwId} not found`);
        }

        const jwId = isolated.sectionJwId + 93;

        await db.exam.create({
          data: {
            jwId,
            sectionId: section.id,
            examDate: new Date(`${overviewDate}T00:00:00.000Z`),
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
          atTime: `${overviewDate}T10:00:00+08:00`,
        });

        expect(
          (result.deadlines ?? []).some(
            (deadline) =>
              deadline.type === "exam" && deadline.payload?.jwId === jwId,
          ),
        ).toBe(false);

        expect(
          await db.exam.findUnique({
            where: { jwId },
            select: { sectionId: true, startTime: true, endTime: true },
          }),
        ).toEqual({
          sectionId: isolated.sectionId,
          startTime: 900,
          endTime: 1100,
        });
      }),
  );

  anchoredTimeTest(
    "workspace_deadline_list 将仅日期 atTime 视为上海天开始",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const dueAt = `${overviewDate}T06:30:00+08:00`;
        const todo = await db.todo.create({
          data: {
            userId: isolated.userId,
            title: "[integration-test] early date-only deadline",
            dueAt: new Date(dueAt),
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          deadlines?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string };
          }>;
        }>("workspace_deadline_list", {
          locale: "zh-cn",
          dayLimit: 1,
          atTime: overviewDate,
        });

        expect(
          (result.deadlines ?? []).some(
            (deadline) =>
              deadline.type === "todo_due" &&
              deadline.at === dueAt &&
              deadline.payload?.id === todo.id,
          ),
        ).toBe(true);

        expect(
          await db.todo.findUnique({
            where: { id: todo.id },
            select: { userId: true, dueAt: true },
          }),
        ).toEqual({ userId: isolated.userId, dueAt: new Date(dueAt) });
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get 使用 atTime 反映种子日课程数及样本限制",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const dueAt = `${overviewDate}T18:00:00+08:00`;
        const todo = await db.todo.create({
          data: {
            userId: isolated.userId,
            title: "[integration-test] overview sample todo",
            dueAt: new Date(dueAt),
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          overview?: {
            pendingTodosCount?: number;
            todaySchedulesCount?: number;
            upcomingExamsCount?: number;
          };
          samples?: {
            dueTodos?: Array<{ id?: string; dueAt?: string | null }>;
          };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
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
          atTime: overviewAtTime,
          mode: "default",
        });
        expect(Array.isArray(summary.samples?.dueTodos)).toBe(true);

        expect(snapshot).toMatchObject({
          todaySchedulesCount: 1,
          upcomingExamsCount: 1,
          pendingTodosCount: 1,
          pendingHomeworksCount: 1,
        });
        expect(result.samples?.dueTodos?.map((item) => item.id)).toEqual([
          todo.id,
        ]);
        expect(
          await db.todo.findUnique({
            where: { id: todo.id },
            select: { userId: true, dueAt: true },
          }),
        ).toEqual({ userId: isolated.userId, dueAt: new Date(dueAt) });
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get 将仅日期 atTime 视为上海天开始",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const dueAt = `${overviewDate}T06:30:00+08:00`;
        const todo = await db.todo.create({
          data: {
            userId: isolated.userId,
            title: "[integration-test] early date-only overview todo",
            dueAt: new Date(dueAt),
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          samples?: { dueTodos?: Array<{ dueAt?: string; id?: string }> };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime: overviewDate,
          limit: 30,
          mode: "full",
        });

        expect(
          result.samples?.dueTodos?.some(
            (item) => item.id === todo.id && item.dueAt === dueAt,
          ),
        ).toBe(true);

        expect(
          await db.todo.findUnique({
            where: { id: todo.id },
            select: { userId: true, dueAt: true },
          }),
        ).toEqual({ userId: isolated.userId, dueAt: new Date(dueAt) });
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get 遵守紧凑总览作业窗口",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const title = `[integration-test] outside overview window ${Date.now()}`;
        const homework = await db.homework.create({
          data: {
            createdById: isolated.userId,
            isMajor: false,
            requiresTeam: false,
            sectionId: isolated.sectionId,
            submissionDueAt: new Date(
              `${overviewPlusSevenDays}T09:00:00+08:00`,
            ),
            title,
            updatedById: isolated.userId,
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          samples?: { dueHomeworks?: Array<{ id?: string; title?: string }> };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
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
          atTime: overviewAtTime,
          homeworkWindowDays: 14,
          limit: 50,
          mode: "full",
        });

        expect(
          extendedWindowResult.samples?.dueHomeworks?.some(
            (sample) => sample.id === homework.id || sample.title === title,
          ),
        ).toBe(true);

        expect(
          await db.homework.findUnique({
            where: { id: homework.id },
            select: {
              sectionId: true,
              createdById: true,
              submissionDueAt: true,
            },
          }),
        ).toEqual({
          sectionId: isolated.sectionId,
          createdById: isolated.userId,
          submissionDueAt: new Date("2026-05-06T09:00:00+08:00"),
        });
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get summary 兼容输入与 default 结构和值一致",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const atTime = `${overviewPlusTwelveDays}T12:00:00+08:00`;
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
            mode: "default",
          },
        );

        expect(summaryPayload).toEqual(defaultPayload);
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get 排除当天已结束的考试",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const atTime = `${overviewDate}T12:00:00+08:00`;
        const before = await isolated.client.call<{
          overview?: { upcomingExamsCount?: number };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime,
        });

        const section = await db.section.findUniqueOrThrow({
          where: { jwId: isolated.sectionJwId },
          select: { id: true },
        });
        await db.exam.create({
          data: {
            jwId: isolated.sectionJwId + 80,
            examDate: new Date(`${overviewDate}T00:00:00.000Z`),
            endTime: 1000,
            examMode: "closed",
            examTakeCount: 1,
            examType: 1,
            sectionId: section.id,
            startTime: 900,
          },
        });

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
            (exam) => exam.jwId === isolated.sectionJwId + 80,
          ),
        ).toBe(false);

        expect(result.overview?.upcomingExamsCount).toBe(1);
        expect(
          await db.exam.count({ where: { sectionId: isolated.sectionId } }),
        ).toBe(2);
      }),
  );

  anchoredTimeTest(
    "workspace_overview_get 从未知日期考试中排除待考计数",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const before = await isolated.client.call<{
          overview?: { upcomingExamsCount?: number };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
        });

        const section = await db.section.findUniqueOrThrow({
          where: { jwId: isolated.sectionJwId },
          select: { id: true },
        });
        await db.exam.create({
          data: {
            jwId: isolated.sectionJwId + 81,
            endTime: 1000,
            examDate: null,
            examMode: "closed",
            examTakeCount: 1,
            examType: 1,
            sectionId: section.id,
            startTime: 900,
          },
        });

        const result = await isolated.client.call<{
          overview?: { upcomingExamsCount?: number };
          samples?: { upcomingExams?: Array<{ jwId?: number }> };
        }>("workspace_overview_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
          limit: 30,
        });

        expect(result.overview?.upcomingExamsCount).toBe(
          before.overview?.upcomingExamsCount,
        );
        expect(
          result.samples?.upcomingExams?.some(
            (exam) => exam.jwId === isolated.sectionJwId + 81,
          ),
        ).toBe(false);

        expect(result.overview?.upcomingExamsCount).toBe(1);
        expect(
          await db.exam.findUnique({
            where: { jwId: isolated.sectionJwId + 81 },
            select: { sectionId: true, examDate: true },
          }),
        ).toEqual({ sectionId: isolated.sectionId, examDate: null });
      }),
  );
});

describe("workspace_snapshot_get — 默认模式紧凑性", () => {
  workspaceTest(
    "atTime 锚定下一节课、截止日期和事件",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const workspaceResult = await isolated.client.call<{
          nextClass?: {
            type?: string;
            at?: string | null;
            payload?: { id?: number };
          };
          upcomingDeadlines?: {
            total?: number;
            items?: Array<{ type?: string; at?: string | null }>;
          };
          upcomingEvents?: { total?: number };
        }>("workspace_snapshot_get", {
          locale: "zh-cn",
          mode: "default",
          atTime: overviewAtTime,
        });

        expect(workspaceResult.nextClass?.type).toBe("schedule");
        expect(workspaceResult.nextClass?.at?.slice(0, 10)).toBe(overviewDate);
        expect(workspaceResult.upcomingDeadlines?.total).toBeGreaterThan(0);
        expect(workspaceResult.upcomingEvents?.total).toBeGreaterThan(0);

        expect(workspaceResult.nextClass).toMatchObject({
          at: "2026-04-29T08:30:00+08:00",
          payload: { id: isolated.schedules[0]?.id },
        });
        expect(workspaceResult.upcomingDeadlines?.total).toBe(2);
      }),
  );

  workspaceTest(
    "nextClass payload 中移除 scheduleGroup 和 roomType",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
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
          atTime: overviewAtTime,
        });

        if (workspaceResult.nextClass?.payload) {
          expect(workspaceResult.nextClass.payload).not.toHaveProperty(
            "scheduleGroup",
          );
          expect(workspaceResult.nextClass.payload).not.toHaveProperty(
            "roomType",
          );
        }
        expect(
          typeof workspaceResult.subscriptions?.currentSemesterSectionsTotal,
        ).toBe("number");
        expect(typeof workspaceResult.todos?.incompleteCount).toBe("number");

        expect(workspaceResult.nextClass?.payload).toBeDefined();
        expect(
          workspaceResult.subscriptions?.currentSemesterSectionsTotal,
        ).toBe(1);
        expect(workspaceResult.todos?.incompleteCount).toBe(0);
      }),
  );

  workspaceTest(
    "summary 兼容输入与 default 返回相同结构",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const def = await isolated.client.callTool("workspace_snapshot_get", {
          locale: "zh-cn",
          mode: "default",
          atTime: overviewAtTime,
        });
        const sum = await isolated.client.callTool("workspace_snapshot_get", {
          locale: "zh-cn",
          mode: "default",
          atTime: overviewAtTime,
        });
        expect(sum).toEqual(def);
      }),
  );

  workspaceTest(
    "full 模式保留 default 的容器类型与合成键",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
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
          atTime: overviewAtTime,
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

        expect(full.bus).toMatchObject({
          hasPreference: false,
          departures: [],
        });
        expect(full.subscriptions?.currentSemesterSections).toHaveLength(1);
      }),
  );

  workspaceTest(
    "当前学期无关注班级时仍可按学期回溯往期数据",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const historical = await createPrivateMcpHistoricalOverview(
          db,
          isolated.userId,
          isolated.sectionId,
        );
        const previousSection = historical.section;

        const workspaceResult = await isolated.client.call<{
          subscriptions?: {
            totalCount?: number;
            currentSemesterCount?: number;
          };
        }>("workspace_snapshot_get", {
          locale: "zh-cn",
          atTime: overviewAtTime,
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
              title: historical.homework.title,
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

        expect(sections.sections?.map((row) => row.id)).toEqual([
          previousSection.id,
        ]);
        expect(homeworks.homeworks).toHaveLength(1);
        expect(schedules.schedules).toHaveLength(1);
        expect(exams.exams).toHaveLength(1);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: isolated.userId },
            select: { sectionId: true },
          }),
        ).toEqual([{ sectionId: previousSection.id }]);
        expect(
          await db.homework.findMany({
            where: { sectionId: previousSection.id },
            select: { id: true, createdById: true },
          }),
        ).toEqual([
          { id: historical.homework.id, createdById: isolated.userId },
        ]);
      }),
  );
});

describe("workspace_schedule_next — 聚焦下一节课", () => {
  workspaceTest(
    "atTime 锚定下一节课并与 snapshot 一致",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const [snapshot, next] = await Promise.all([
          isolated.client.call<{
            nextClass?: {
              type?: string;
              at?: string | null;
              payload?: { id?: number };
            };
          }>("workspace_snapshot_get", {
            locale: "zh-cn",
            atTime: overviewAtTime,
          }),
          isolated.client.call<{
            found?: boolean;
            nextClass?: {
              type?: string;
              at?: string | null;
              payload?: { id?: number };
            };
            currentSemester?: { code?: string | null; nameCn?: string | null };
          }>("workspace_schedule_next", {
            locale: "zh-cn",
            atTime: overviewAtTime,
          }),
        ]);

        expect(next.found).toBe(true);
        expect(next.nextClass).toEqual(snapshot.nextClass);
        expect(next.nextClass?.type).toBe("schedule");
        expect(next.nextClass?.at?.slice(0, 10)).toBe(overviewDate);
        expect(next.currentSemester?.code).toBeDefined();

        expect(next.nextClass).toMatchObject({
          at: "2026-04-29T08:30:00+08:00",
          payload: { id: isolated.schedules[0]?.id },
        });
        expect(next.currentSemester?.code).toBe("mcp-semester");
      }),
  );

  workspaceTest(
    "default 模式紧凑化 nextClass payload",
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, isolated, expect }) =>
      mcpWorkflow.run(async () => {
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
          atTime: overviewAtTime,
        });

        expect(next.found).toBe(true);
        if (next.nextClass?.payload) {
          expect(next.nextClass.payload).not.toHaveProperty("scheduleGroup");
          expect(next.nextClass.payload).not.toHaveProperty("roomType");
        }

        expect(next.nextClass?.payload).toBeDefined();
      }),
  );
});
