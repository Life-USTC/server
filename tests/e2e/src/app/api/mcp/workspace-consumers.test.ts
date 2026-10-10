import { expect } from "@playwright/test";
import {
  anchor,
  arrangeAcademic,
  arrangeBus,
  arrangeHomework,
  arrangeSection,
  facts,
} from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

for (const [domain, feature] of [
  ["Todo", "workspace.todo"],
  ["Homework", "workspace.homework"],
  ["Schedule", "workspace.schedule"],
  ["Exam", "workspace.exam"],
  ["Overview", "workspace.overview"],
  ["Calendar", "workspace.calendar"],
] as const) {
  test(`MCP workspace consumers project independently prepared state ${domain}`, {
    tag: `@${domain}/MCP`,
  }, async ({ mcpRun }) => {
    await mcpRun(
      {
        calls: (
          [
            ["workspace_todo_list", "workspace.todo", "read"],
            ["workspace_homework_list", "workspace.homework", "read"],
            ["workspace_schedule_list", "workspace.schedule", "read"],
            ["workspace_exam_list", "workspace.exam", "read"],
            ["workspace_overview_get", "workspace.overview", "read"],
            ["workspace_overview_get", "workspace.overview", "read"],
            ["workspace_snapshot_get", "workspace.overview", "read"],
            ["workspace_snapshot_get", "workspace.overview", "read"],
            ["workspace_schedule_next", "workspace.overview", "read"],
            ["workspace_deadline_list", "workspace.overview", "read"],
            ["workspace_calendar_timeline_get", "workspace.calendar", "read"],
            ["workspace_calendar_timeline_get", "workspace.calendar", "read"],
            ["workspace_calendar_event_list", "workspace.calendar", "read"],
            ["workspace_calendar_event_list", "workspace.calendar", "read"],
          ] as const
        ).filter(([, owner]) => owner === feature),
        usage: (
          [
            ["workspace.todo", 1, 0],
            ["workspace.homework", 1, 0],
            ["workspace.schedule", 1, 0],
            ["workspace.exam", 1, 0],
            ["workspace.overview", 6, 0],
            ["workspace.calendar", 4, 0],
          ] as const
        ).filter(([owner]) => owner === feature),
      },
      async ({ mcp, oauth, observeCalendar }) => {
        await observeCalendar([], { calendar: "absent" });
        const db = oauth.worker.database.owner;
        const userId = oauth.user.id;
        const {
          section,
          homework,
          schedule,
          exam,
          todo,
          completedTodo,
          membership,
          preference,
        } = await db.$transaction(async (tx) => {
          const section = await arrangeAcademic(tx);
          const homework = await arrangeHomework(tx, userId, section.id);
          const schedule = await tx.schedule.findFirstOrThrow({
            where: { sectionId: section.id },
          });
          const exam = await tx.exam.findFirstOrThrow({
            where: { sectionId: section.id },
          });
          const membership = await tx.userSectionSubscription.create({
            data: { userId, sectionId: section.id },
          });
          const todo = await tx.todo.create({
            data: {
              userId,
              title: facts.todos.dueTodayTitle,
              dueAt: new Date("2026-04-29T15:00:00+08:00"),
            },
          });
          const completedTodo = await tx.todo.create({
            data: {
              userId,
              title: facts.todos.completedTitle,
              completed: true,
            },
          });
          await arrangeBus(tx);
          const preference = await tx.busUserPreference.create({
            data: {
              userId,
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 2,
            },
          });
          return {
            section,
            homework,
            schedule,
            exam,
            todo,
            completedTodo,
            membership,
            preference,
          };
        });

        // Expected identities come from arrangement; expectations never use another reader.
        const events = [
          {
            type: "schedule",
            at: "2026-04-29T09:00:00+08:00",
            payload: { id: schedule.id },
          },
          {
            type: "homework_due",
            at: "2026-04-29T12:00:00+08:00",
            payload: { id: homework.id },
          },
          {
            type: "exam",
            at: "2026-04-29T13:00:00+08:00",
            payload: { id: exam.id },
          },
          {
            type: "todo_due",
            at: "2026-04-29T15:00:00+08:00",
            payload: { id: todo.id },
          },
        ];
        async function read(name: string, args: Record<string, unknown> = {}) {
          const result = await mcp.callTool({ name, arguments: args });
          expect(result.isError).not.toBe(true);
          return parseTextContent(result);
        }
        if (domain === "Todo") {
          const todos = await read("workspace_todo_list");
          expect(todos.counts).toMatchObject({ incomplete: 1, completed: 1 });
          expect(todos.todos).toMatchObject([
            { id: todo.id, title: facts.todos.dueTodayTitle, completed: false },
          ]);
        }
        if (domain === "Homework") {
          const homeworks = await read("workspace_homework_list", {
            completed: false,
            limit: 30,
            locale: "zh-cn",
          });
          expect(homeworks.homeworks).toMatchObject([
            {
              id: homework.id,
              title: facts.homeworks.title,
              completion: null,
              commentCount: 0,
            },
          ]);
        }
        if (domain === "Schedule") {
          const schedules = await read("workspace_schedule_list", {
            limit: 30,
            locale: "zh-cn",
          });
          expect(schedules.schedules).toMatchObject([{ id: schedule.id }]);
        }
        if (domain === "Exam") {
          const exams = await read("workspace_exam_list", {
            includeDateUnknown: true,
            limit: 30,
            locale: "zh-cn",
          });
          expect(exams.exams).toMatchObject([{ id: exam.id }]);
        }
        if (domain === "Overview") {
          const reference = {
            atTime: anchor.recommendedAtTime,
            locale: "zh-cn",
          };
          const overview = await read("workspace_overview_get", {
            ...reference,
            limit: 2,
          });
          expect(overview.overview).toEqual({
            pendingTodosCount: 1,
            pendingHomeworksCount: 1,
            todaySchedulesCount: 1,
            upcomingExamsCount: 1,
          });
          expect(overview.samples).toMatchObject({
            dueTodos: [{ id: todo.id }],
            dueHomeworks: [{ id: homework.id }],
            upcomingExams: [{ id: exam.id }],
          });
          const overviewDefault = await read("workspace_overview_get", {
            ...reference,
            limit: 2,
            mode: "default",
          });
          expect(overviewDefault).toEqual(overview);

          const snapshot = await read("workspace_snapshot_get", reference);
          expect(snapshot).toMatchObject({
            currentSemester: { code: "421" },
            subscriptions: {
              totalCount: 1,
              currentSemesterCount: 1,
              currentSemesterSectionsTotal: 1,
              currentSemesterSections: [{ jwId: section.jwId }],
            },
            nextClass: events[0],
            upcomingDeadlines: { total: 3, items: events.slice(1) },
            todos: { incompleteCount: 1, items: [{ id: todo.id }] },
            bus: {
              hasPreference: true,
              nextDeparture: { routeId: facts.bus.routeId },
            },
          });
          expect(snapshot.nextClass).not.toHaveProperty(
            "payload.scheduleGroup",
          );
          expect(snapshot.nextClass).not.toHaveProperty("payload.roomType");
          const snapshotDefault = await read("workspace_snapshot_get", {
            ...reference,
            mode: "default",
          });
          expect(snapshotDefault).toEqual(snapshot);

          const nextClass = await read("workspace_schedule_next", reference);
          expect(nextClass).toMatchObject({
            found: true,
            nextClass: events[0],
          });
          const deadlines = await read("workspace_deadline_list", {
            ...reference,
            dayLimit: 7,
          });
          expect(deadlines).toMatchObject({
            total: 3,
            deadlines: events.slice(1),
          });
        }
        if (domain === "Calendar") {
          const timelineArgs = {
            locale: "zh-cn",
            atTime: anchor.startOfDayAtTime,
          };
          const timeline = await read(
            "workspace_calendar_timeline_get",
            timelineArgs,
          );
          expect(timeline).toMatchObject({
            total: 4,
            range: {
              from: "2026-04-29T00:00:00+08:00",
              to: "2026-05-06T00:00:00+08:00",
            },
            events,
          });
          const timelineDefault = await read(
            "workspace_calendar_timeline_get",
            {
              ...timelineArgs,
              mode: "default",
            },
          );
          expect(timelineDefault).toEqual(timeline);
          const calendarArgs = {
            dateFrom: anchor.startOfDayAtTime,
            dateTo: "2026-05-10T23:59:59+08:00",
            locale: "zh-cn",
          };
          const calendar = await read(
            "workspace_calendar_event_list",
            calendarArgs,
          );
          expect(calendar.events).toMatchObject(events);
          const calendarDefault = await read("workspace_calendar_event_list", {
            ...calendarArgs,
            mode: "default",
          });
          expect(calendarDefault).toEqual(calendar);
        }
        return {
          async verifyState() {
            expect(await db.homework.findMany()).toEqual([homework]);
            expect(await db.homeworkCompletion.findMany()).toEqual([]);
            expect(await db.todo.findMany({ orderBy: { id: "asc" } })).toEqual(
              [todo, completedTodo].sort((a, b) => a.id.localeCompare(b.id)),
            );
            expect(await db.schedule.findMany()).toEqual([schedule]);
            expect(await db.exam.findMany()).toEqual([exam]);
            expect(await db.userSectionSubscription.findMany()).toEqual([
              membership,
            ]);
            expect(await db.busUserPreference.findMany()).toEqual([preference]);
          },
        };
      },
    );
  });
}

test("MCP calendar feed consumer exposes current membership without credentials", {
  tag: "@Calendar/MCP",
}, async ({ mcpRun }) => {
  await mcpRun(
    {
      calls: [
        ["workspace_calendar_feed_get", "workspace.subscription", "read"],
        ["workspace_calendar_feed_get", "workspace.subscription", "read"],
      ],
      usage: [["workspace.subscription", 2, 0]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      await observeCalendar([], { calendar: "absent" });
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { section, membership } = await db.$transaction(async (tx) => {
        const section = await arrangeSection(tx);
        // This endpoint uses server time, unlike the explicitly anchored agenda reads.
        const year = new Date().getUTCFullYear();
        await tx.semester.update({
          where: { jwId: facts.semesterJwId },
          data: {
            startDate: new Date(Date.UTC(year, 0, 1)),
            endDate: new Date(Date.UTC(year + 1, 0, 1)),
          },
        });
        const membership = await tx.userSectionSubscription.create({
          data: { userId, sectionId: section.id },
        });
        return { section, membership };
      });

      async function read(name: string, args: Record<string, unknown>) {
        const result = await mcp.callTool({ name, arguments: args });
        expect(result.isError).not.toBe(true);
        return parseTextContent(result);
      }
      const feed = await read("workspace_calendar_feed_get", {
        locale: "zh-cn",
      });
      expect(feed).toMatchObject({
        success: true,
        subscription: {
          userId,
          sectionCount: 1,
          currentSemesterSectionCount: 1,
          currentSemesterSections: [{ id: section.id }],
        },
      });
      expect(feed.subscription).not.toHaveProperty("sections");
      expect(feed.subscription).not.toHaveProperty("calendarPath");
      expect(feed.subscription).not.toHaveProperty("calendarUrl");
      const feedDefault = await read("workspace_calendar_feed_get", {
        locale: "zh-cn",
        mode: "default",
      });
      expect(feedDefault).toEqual(feed);
      return {
        async verifyState() {
          expect(await db.userSectionSubscription.findMany()).toEqual([
            membership,
          ]);
        },
      };
    },
  );
});
