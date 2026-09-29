import { describe } from "vitest";
import { catalogMcpTest } from "./_harness/catalog-fixture";

const toolTest = catalogMcpTest.extend(
  "owner",
  async ({ mcpActor, mcpCatalog, isolatedDatabase }) => {
    const homework = await isolatedDatabase.owner.$transaction(async (db) => {
      await db.user.update({
        where: { id: mcpActor.userId },
        data: { name: "[integration-test] private-author-identity" },
      });
      await db.userSectionSubscription.create({
        data: { userId: mcpActor.userId, sectionId: mcpCatalog.section.id },
      });
      return db.homework.create({
        data: {
          sectionId: mcpCatalog.section.id,
          createdById: mcpActor.userId,
          title: "Mode parity homework",
          publishedAt: new Date(`${mcpCatalog.date}T07:00:00+08:00`),
          submissionDueAt: new Date(`${mcpCatalog.date}T18:00:00+08:00`),
          description: {
            create: {
              content: "Mode parity **homework description**",
              lastEditedById: mcpActor.userId,
            },
          },
        },
      });
    });
    return { ...mcpActor, sectionJwId: mcpCatalog.section.jwId, homework };
  },
);

function valueKind(value: unknown) {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

describe("MCP domain projections through the SDK and production database role", () => {
  toolTest(
    "mcp.output-modes",
    { timeout: 30_000 },
    async ({ owner, mcpCatalog, mcpBus, isolatedDatabase, expect }) => {
      const {
        date: anchorDate,
        atTime: anchorAtTime,
        elevenDaysLater,
      } = mcpCatalog;
      await isolatedDatabase.owner.todo.create({
        data: {
          userId: owner.userId,
          title: "[integration-test] mode shape task",
          dueAt: new Date(`${anchorDate}T18:00:00+08:00`),
        },
      });
      const tools: Array<[string, Record<string, unknown>]> = [
        ["workspace_snapshot_get", { atTime: anchorAtTime }],
        ["workspace_schedule_next", { atTime: anchorAtTime }],
        ["workspace_overview_get", { atTime: anchorAtTime }],
        ["workspace_calendar_timeline_get", { atTime: anchorAtTime }],
        ["workspace_deadline_list", { atTime: anchorAtTime }],
        ["workspace_subscription_list", {}],
        ["workspace_calendar_feed_get", {}],
        ["workspace_todo_list", {}],
        ["workspace_homework_list", {}],
        [
          "workspace_schedule_list",
          {
            dateFrom: anchorDate,
            dateTo: elevenDaysLater,
          },
        ],
        ["workspace_exam_list", { dateFrom: anchorDate }],
        ["catalog_course_get", { jwId: mcpCatalog.course.jwId }],
        ["catalog_bus_route_get", { routeId: mcpBus.routeId }],
        ["catalog_link_list", {}],
        [
          "community_comment_list",
          {
            targetType: "section",
            sectionJwId: owner.sectionJwId,
          },
        ],
      ];
      for (const [name, args] of tools) {
        const compact = await owner.client.call(name, {
          ...args,
          mode: "default",
        });
        const full = await owner.client.call(name, { ...args, mode: "full" });
        expect(compact.success, name).toBe(true);
        expect(full.success, name).toBe(true);
        for (const result of [compact, full]) {
          if (name === "workspace_homework_list")
            expect(result.homeworks).toEqual([
              expect.objectContaining({
                id: owner.homework.id,
                title: "Mode parity homework",
              }),
            ]);
          if (name === "workspace_schedule_list")
            expect(result.schedules).toEqual([
              expect.objectContaining({
                id: mcpCatalog.schedule.id,
                teachers: [expect.objectContaining({ nameCn: "测试教师" })],
              }),
            ]);
          if (name === "workspace_exam_list")
            expect(result.exams).toEqual([
              expect.objectContaining({
                id: mcpCatalog.exam.id,
                examRooms: [
                  expect.objectContaining({
                    room: "Catalog exam room",
                    count: 30,
                  }),
                ],
              }),
            ]);
        }
        for (const [key, value] of Object.entries(compact)) {
          expect(Object.hasOwn(full, key), `${name}.${key}`).toBe(true);
          expect(valueKind(full[key]), `${name}.${key}`).toBe(valueKind(value));
          if (Array.isArray(value))
            expect(full[key], `${name}.${key}`).toHaveLength(value.length);
        }
      }
    },
  );

  toolTest(
    "mcp.privacy-safe-default",
    { timeout: 30_000 },
    async ({ owner, mcpOtherActor: reader, isolatedDatabase, expect }) => {
      const secret = "private-calendar-credential-mode-test";
      await isolatedDatabase.owner.user.update({
        where: { id: owner.userId },
        data: { calendarFeedToken: secret },
      });
      const ownerTodo = await isolatedDatabase.owner.todo.create({
        data: {
          userId: owner.userId,
          title: "[integration-test] owner private todo marker",
          content: "owner private content marker",
        },
      });
      const readerTodo = await isolatedDatabase.owner.todo.create({
        data: {
          userId: reader.userId,
          title: "[integration-test] reader private todo marker",
        },
      });
      const comment = await owner.client.call<{ success: boolean; id: string }>(
        "community_comment_create",
        {
          targetType: "section",
          sectionJwId: owner.sectionJwId,
          body: "[integration-test] anonymous mode comment",
          visibility: "public",
          isAnonymous: true,
        },
      );
      expect(comment.success).toBe(true);
      for (const mode of ["default", "full"]) {
        for (const [viewer, own, foreign] of [
          [owner, ownerTodo, readerTodo],
          [reader, readerTodo, ownerTodo],
        ] as const) {
          const listed = await viewer.client.call<{
            success: boolean;
            todos: Array<{ id: string }>;
          }>("workspace_todo_list", { mode });
          expect(listed.success).toBe(true);
          expect(listed.todos.map((todo) => todo.id)).toEqual([own.id]);
          expect(JSON.stringify(listed)).not.toContain(foreign.title);
          const denied = await viewer.client.call("workspace_todo_update", {
            id: foreign.id,
            title: "foreign write",
            mode,
          });
          expect(denied.success).toBe(false);
          expect(JSON.stringify(denied)).not.toContain(foreign.title);
          expect(
            await isolatedDatabase.owner.todo.findUnique({
              where: { id: foreign.id },
              select: { title: true },
            }),
          ).toEqual({ title: foreign.title });
        }
        const thread = await reader.client.call<{
          success: boolean;
          thread: Array<{
            id: string;
            author: unknown;
            authorHidden: boolean;
          }>;
        }>("community_comment_get", { commentId: comment.id, mode });
        expect(thread.success).toBe(true);
        expect(
          thread.thread.find((node) => node.id === comment.id),
        ).toMatchObject({ author: null, authorHidden: true });
        for (const hidden of [
          owner.userId,
          "private-author-identity",
          ownerTodo.content,
        ]) {
          expect(JSON.stringify(thread)).not.toContain(hidden);
        }
        const calendar = await owner.client.call(
          "workspace_calendar_feed_get",
          { mode },
        );
        expect(calendar.success).toBe(true);
        const calendarJson = JSON.stringify(calendar);
        for (const hidden of [
          secret,
          "calendarPath",
          "calendarUrl",
          "calendarFeedToken",
          "/api/calendar-feeds/",
        ]) {
          expect(calendarJson).not.toContain(hidden);
        }
      }
    },
  );
});
