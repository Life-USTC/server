/**
 * MCP seeded tools — 种子工具：工作区待办课表与订阅
 */

import { expect, test } from "@playwright/test";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import { parseTextContent } from "./helpers";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("种子工具：工作区待办课表与订阅", async ({ page, request }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;
    const currentUser = session.currentUser;

    try {
      const todosResult = await mcpClient.callTool({
        name: "workspace_todo_list",
        arguments: {},
      });
      const todosPayload = parseTextContent(todosResult) as {
        counts?: {
          incomplete?: number;
          completed?: number;
          overdue?: number;
        };
        todos?: Array<{ title?: string; completed?: boolean }>;
      };
      expect(typeof todosPayload.counts?.incomplete).toBe("number");
      expect(typeof todosPayload.counts?.completed).toBe("number");
      expect(
        todosPayload.todos?.some(
          (todo) =>
            todo.title === DEV_SEED.todos.dueTodayTitle &&
            todo.completed === false,
        ),
      ).toBe(true);
      expect(
        todosPayload.todos?.some(
          (todo) =>
            todo.title === DEV_SEED.todos.completedTitle &&
            todo.completed === true,
        ),
      ).toBe(false);
      const myHomeworksResult = await mcpClient.callTool({
        name: "workspace_homework_list",
        arguments: {
          completed: false,
          limit: 30,
          locale: "zh-cn",
        },
      });
      const myHomeworksPayload = parseTextContent(myHomeworksResult) as {
        homeworks?: Array<{
          id?: string;
          title?: string;
          completion?: { completedAt?: string } | null;
          commentCount?: number;
        }>;
      };
      expect(
        myHomeworksPayload.homeworks?.some(
          (homework) => homework.title === DEV_SEED.homeworks.title,
        ),
      ).toBe(true);
      expect(
        myHomeworksPayload.homeworks?.some(
          (homework) =>
            typeof homework.commentCount === "number" &&
            Object.hasOwn(homework, "completion"),
        ),
      ).toBe(true);
      const firstHomeworkId = myHomeworksPayload.homeworks?.[0]?.id;
      expect(typeof firstHomeworkId).toBe("string");

      const setCompletionTrueResult = await mcpClient.callTool({
        name: "workspace_homework_completion_set",
        arguments: {
          homeworkId: firstHomeworkId,
          completed: true,
        },
      });
      const setCompletionTruePayload = parseTextContent(
        setCompletionTrueResult,
      ) as {
        success?: boolean;
        completion?: { completed?: boolean };
      };
      expect(setCompletionTruePayload.success).toBe(true);
      expect(setCompletionTruePayload.completion?.completed).toBe(true);

      const setCompletionFalseResult = await mcpClient.callTool({
        name: "workspace_homework_completion_set",
        arguments: {
          homeworkId: firstHomeworkId,
          completed: false,
        },
      });
      const setCompletionFalsePayload = parseTextContent(
        setCompletionFalseResult,
      ) as {
        success?: boolean;
        completion?: { completed?: boolean };
      };
      expect(setCompletionFalsePayload.success).toBe(true);
      expect(setCompletionFalsePayload.completion?.completed).toBe(false);
      const mySchedulesResult = await mcpClient.callTool({
        name: "workspace_schedule_list",
        arguments: {
          limit: 30,
          locale: "zh-cn",
        },
      });
      const mySchedulesPayload = parseTextContent(mySchedulesResult) as {
        schedules?: Array<{ id?: number }>;
      };
      expect((mySchedulesPayload.schedules?.length ?? 0) > 0).toBe(true);

      const myExamsResult = await mcpClient.callTool({
        name: "workspace_exam_list",
        arguments: {
          includeDateUnknown: true,
          limit: 30,
          locale: "zh-cn",
        },
      });
      const myExamsPayload = parseTextContent(myExamsResult) as {
        exams?: Array<{ id?: number }>;
      };
      expect((myExamsPayload.exams?.length ?? 0) > 0).toBe(true);

      const overviewResult = await mcpClient.callTool({
        name: "workspace_overview_get",
        arguments: {
          limit: 2,
          locale: "zh-cn",
        },
      });
      const overviewPayload = parseTextContent(overviewResult) as {
        overview?: {
          pendingTodosCount?: number;
          pendingHomeworksCount?: number;
          todaySchedulesCount?: number;
          upcomingExamsCount?: number;
        };
        samples?: {
          dueTodos?: Array<{ id?: string }>;
          dueHomeworks?: Array<{ id?: string }>;
          upcomingExams?: Array<{ id?: number }>;
        };
      };
      expect(typeof overviewPayload.overview?.pendingTodosCount).toBe("number");
      expect(typeof overviewPayload.overview?.pendingHomeworksCount).toBe(
        "number",
      );
      expect(typeof overviewPayload.overview?.todaySchedulesCount).toBe(
        "number",
      );
      expect(typeof overviewPayload.overview?.upcomingExamsCount).toBe(
        "number",
      );
      expect((overviewPayload.samples?.dueTodos?.length ?? 0) <= 2).toBe(true);
      expect((overviewPayload.samples?.dueHomeworks?.length ?? 0) <= 2).toBe(
        true,
      );
      expect((overviewPayload.samples?.upcomingExams?.length ?? 0) <= 2).toBe(
        true,
      );
      const overviewSummaryResult = await mcpClient.callTool({
        name: "workspace_overview_get",
        arguments: {
          limit: 2,
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const overviewSummaryPayload = parseTextContent(
        overviewSummaryResult,
      ) as {
        samples?: {
          dueTodos?: Array<{ id?: string }>;
          dueHomeworks?: Array<{ id?: string }>;
          upcomingExams?: Array<{ id?: number }>;
        };
      };
      expect(overviewSummaryPayload.samples).toEqual(overviewPayload.samples);

      const dashboardResult = await mcpClient.callTool({
        name: "workspace_snapshot_get",
        arguments: {
          locale: "zh-cn",
        },
      });
      const dashboardPayload = parseTextContent(dashboardResult) as {
        currentSemester?: { code?: string | null };
        subscriptions?: {
          currentSemesterCount?: number;
          currentSemesterSectionsTotal?: number;
          currentSemesterSections?: Array<{ jwId?: number }>;
        };
        nextClass?: {
          payload?: { scheduleGroup?: unknown; roomType?: unknown };
        };
        upcomingDeadlines?: {
          total?: number;
          items?: Array<{ type?: string }>;
        };
        todos?: { incompleteCount?: number; items?: Array<{ id?: string }> };
        bus?: {
          nextDeparture?: { routeId?: number | null } | null;
          departures?: Array<{ routeId?: number | null }>;
        };
      };
      expect(dashboardPayload.currentSemester?.code).toBeDefined();
      expect(typeof dashboardPayload.subscriptions?.currentSemesterCount).toBe(
        "number",
      );
      expect(
        dashboardPayload.subscriptions?.currentSemesterSectionsTotal,
      ).toBeGreaterThan(0);
      if (dashboardPayload.nextClass?.payload) {
        expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
          "scheduleGroup",
        );
        expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
          "roomType",
        );
      }
      expect(typeof dashboardPayload.todos?.incompleteCount).toBe("number");
      expect(typeof dashboardPayload.upcomingDeadlines?.total).toBe("number");
      const nextDeparture = dashboardPayload.bus?.nextDeparture ?? null;
      if (nextDeparture) {
        expect(typeof nextDeparture.routeId).toBe("number");
      } else {
        expect(nextDeparture).toBeNull();
      }
      const dashboardSummaryResult = await mcpClient.callTool({
        name: "workspace_snapshot_get",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const dashboardSummaryPayload = parseTextContent(
        dashboardSummaryResult,
      ) as {
        subscriptions?: {
          currentSemesterSections?: unknown;
          currentSemesterSectionsTotal?: number;
        };
        upcomingDeadlines?: {
          total?: number;
          items?: Array<{ type?: string }>;
        };
        todos?: { incompleteCount?: number; items?: unknown };
      };
      expect(
        dashboardSummaryPayload.subscriptions?.currentSemesterSections,
      ).toEqual(dashboardPayload.subscriptions?.currentSemesterSections);
      expect(dashboardSummaryPayload.upcomingDeadlines?.items).toEqual(
        dashboardPayload.upcomingDeadlines?.items,
      );
      expect(dashboardSummaryPayload.todos?.items).toEqual(
        dashboardPayload.todos?.items,
      );

      const nextClassResult = await mcpClient.callTool({
        name: "workspace_schedule_next",
        arguments: {
          locale: "zh-cn",
        },
      });
      const nextClassPayload = parseTextContent(nextClassResult) as {
        found?: boolean;
        nextClass?: { type?: string; at?: string | null };
      };
      expect(typeof nextClassPayload.found).toBe("boolean");
      if (nextClassPayload.found) {
        expect(nextClassPayload.nextClass?.type).toBe("schedule");
      }

      const deadlinesResult = await mcpClient.callTool({
        name: "workspace_deadline_list",
        arguments: {
          locale: "zh-cn",
          dayLimit: 7,
        },
      });
      const deadlinesPayload = parseTextContent(deadlinesResult) as {
        total?: number;
        deadlines?: Array<{ type?: string }>;
      };
      expect(typeof deadlinesPayload.total).toBe("number");
      expect(
        deadlinesPayload.deadlines?.every((event) =>
          ["homework_due", "exam", "todo_due"].includes(event.type ?? ""),
        ),
      ).toBe(true);

      const timelineResult = await mcpClient.callTool({
        name: "workspace_calendar_timeline_get",
        arguments: {
          locale: "zh-cn",
          atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
        },
      });
      const timelinePayload = parseTextContent(timelineResult) as {
        total?: number;
        range?: { from?: string; to?: string };
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect(typeof timelinePayload.total).toBe("number");
      expect(timelinePayload.range?.from).toMatch(/\+08:00$/);
      expect(timelinePayload.range?.to).toMatch(/\+08:00$/);
      expect((timelinePayload.events?.length ?? 0) > 0).toBe(true);
      expect(
        timelinePayload.events?.some(
          (event) => typeof event.at === "string" && /\+08:00$/.test(event.at),
        ),
      ).toBe(true);
      expect(
        timelinePayload.events?.some((event) =>
          ["schedule", "homework_due", "exam", "todo_due"].includes(
            event.type ?? "",
          ),
        ),
      ).toBe(true);
      const timelineSummaryResult = await mcpClient.callTool({
        name: "workspace_calendar_timeline_get",
        arguments: {
          locale: "zh-cn",
          atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
          mode: "summary",
        },
      });
      const timelineSummaryPayload = parseTextContent(
        timelineSummaryResult,
      ) as {
        total?: number;
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect(timelineSummaryPayload.events).toEqual(timelinePayload.events);
      expect(timelineSummaryPayload.total).toBe(timelinePayload.total);

      const calendarEventsResult = await mcpClient.callTool({
        name: "workspace_calendar_event_list",
        arguments: {
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
        },
      });
      const calendarEventsPayload = parseTextContent(calendarEventsResult) as {
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect((calendarEventsPayload.events?.length ?? 0) > 0).toBe(true);

      const calendarEventsSummaryResult = await mcpClient.callTool({
        name: "workspace_calendar_event_list",
        arguments: {
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const calendarEventsSummaryPayload = parseTextContent(
        calendarEventsSummaryResult,
      ) as {
        events?: Array<{ type?: string; at?: string | null }>;
      };
      expect(calendarEventsSummaryPayload.events).toEqual(
        calendarEventsPayload.events,
      );
      const todoTitle = `[MCP-E2E-TODO] ${Date.now()}`;
      const createTodoResult = await mcpClient.callTool({
        name: "workspace_todo_create",
        arguments: {
          title: todoTitle,
          content: "todo created by mcp e2e",
          priority: "medium",
          dueAt: new Date().toISOString(),
        },
      });
      const createTodoPayload = parseTextContent(createTodoResult) as {
        success?: boolean;
        id?: string;
      };
      expect(createTodoPayload.success).toBe(true);
      expect(typeof createTodoPayload.id).toBe("string");

      const updateTodoResult = await mcpClient.callTool({
        name: "workspace_todo_update",
        arguments: {
          id: createTodoPayload.id,
          title: `${todoTitle}-updated`,
          completed: true,
        },
      });
      const updateTodoPayload = parseTextContent(updateTodoResult) as {
        success?: boolean;
      };
      expect(updateTodoPayload.success).toBe(true);

      const deleteTodoResult = await mcpClient.callTool({
        name: "workspace_todo_delete",
        arguments: {
          id: createTodoPayload.id,
        },
      });
      const deleteTodoPayload = parseTextContent(deleteTodoResult) as {
        success?: boolean;
      };
      expect(deleteTodoPayload.success).toBe(true);

      const calendarSubscriptionResult = await mcpClient.callTool({
        name: "workspace_calendar_feed_get",
        arguments: {
          locale: "zh-cn",
        },
      });
      const calendarSubscriptionPayload = parseTextContent(
        calendarSubscriptionResult,
      ) as {
        success?: boolean;
        subscription?: {
          userId?: string;
          currentSemesterSections?: Array<{ id?: number }>;
          sections?: Array<{ id?: number }>;
          calendarPath?: never;
          calendarUrl?: never;
        };
      };
      expect(calendarSubscriptionPayload.success).toBe(true);
      expect(calendarSubscriptionPayload.subscription?.userId).toBe(
        currentUser.id,
      );
      expect(
        (calendarSubscriptionPayload.subscription?.currentSemesterSections
          ?.length ?? 0) > 0,
      ).toBe(true);
      expect(
        calendarSubscriptionPayload.subscription?.sections,
      ).toBeUndefined();
      expect(
        calendarSubscriptionPayload.subscription?.calendarPath,
      ).toBeUndefined();
      expect(
        calendarSubscriptionPayload.subscription?.calendarUrl,
      ).toBeUndefined();

      const calendarSubscriptionSummaryResult = await mcpClient.callTool({
        name: "workspace_calendar_feed_get",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const calendarSubscriptionSummaryPayload = parseTextContent(
        calendarSubscriptionSummaryResult,
      ) as {
        subscription?: {
          sectionCount?: number;
          currentSemesterSectionCount?: number;
          currentSemesterSections?: unknown[];
          calendarPath?: never;
          calendarUrl?: never;
        };
      };
      expect(
        calendarSubscriptionSummaryPayload.subscription?.sectionCount,
      ).toBeGreaterThan(0);
      expect(
        Array.isArray(
          calendarSubscriptionSummaryPayload.subscription
            ?.currentSemesterSections,
        ),
      ).toBe(true);
      expect(
        calendarSubscriptionSummaryPayload.subscription?.calendarPath,
      ).toBeUndefined();
      expect(
        calendarSubscriptionSummaryPayload.subscription?.calendarUrl,
      ).toBeUndefined();

      const subscribeResult = await mcpClient.callTool({
        name: "workspace_subscription_import",
        arguments: {
          codes: [DEV_SEED.section.code],
          locale: "zh-cn",
        },
      });
      const subscribePayload = parseTextContent(subscribeResult) as {
        success?: boolean;
        matchedCodes?: string[];
        subscription?: {
          sectionCount?: number;
          currentSemesterSections?: unknown;
          sections?: unknown;
        } | null;
      };
      expect(subscribePayload.success).toBe(true);
      expect(subscribePayload.matchedCodes).toContain(DEV_SEED.section.code);
      expect(typeof subscribePayload.subscription?.sectionCount).toBe("number");
      expect(
        subscribePayload.subscription?.currentSemesterSections,
      ).toBeUndefined();
      expect(subscribePayload.subscription?.sections).toBeUndefined();
    } finally {
      await closeSeededMcpSession(page, session);
    }
  });
});
