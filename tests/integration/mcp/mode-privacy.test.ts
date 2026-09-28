import { describe } from "vitest";
import * as fixtures from "./_harness";
import { mcpTest } from "./_harness/context";

const toolTest = mcpTest
  .extend(
    "owner",
    fixtures.academicActorFixture({
      emailPrefix: "mcp-mode-owner",
      name: "[integration-test] private-author-identity",
    }),
  )
  .extend(
    "reader",
    fixtures.actorFixture({
      emailPrefix: "mcp-mode-reader",
      name: "[integration-test] mode reader",
    }),
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
    async ({ owner, expect }) => {
      const todo = await fixtures.prisma.todo.create({
        data: {
          userId: owner.userId,
          title: "[integration-test] mode shape task",
          dueAt: new Date(`${fixtures.SEED_DATE}T18:00:00+08:00`),
        },
      });
      try {
        const tools: Array<[string, Record<string, unknown>]> = [
          ["workspace_snapshot_get", { atTime: fixtures.SEED_AT_TIME }],
          ["workspace_schedule_next", { atTime: fixtures.SEED_AT_TIME }],
          ["workspace_overview_get", { atTime: fixtures.SEED_AT_TIME }],
          [
            "workspace_calendar_timeline_get",
            { atTime: fixtures.SEED_AT_TIME },
          ],
          ["workspace_deadline_list", { atTime: fixtures.SEED_AT_TIME }],
          ["workspace_subscription_list", {}],
          ["workspace_calendar_feed_get", {}],
          ["workspace_todo_list", {}],
          ["workspace_homework_list", {}],
          [
            "workspace_schedule_list",
            {
              dateFrom: fixtures.SEED_DATE,
              dateTo: fixtures.SEED_PLUS_ELEVEN_DAYS,
            },
          ],
          ["workspace_exam_list", { dateFrom: fixtures.SEED_DATE }],
          ["catalog_course_get", { jwId: fixtures.DEV_SEED.course.jwId }],
          [
            "catalog_bus_route_get",
            { routeId: fixtures.DEV_SEED.bus.recommendedRouteId },
          ],
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
          for (const [key, value] of Object.entries(compact)) {
            expect(Object.hasOwn(full, key), `${name}.${key}`).toBe(true);
            expect(valueKind(full[key]), `${name}.${key}`).toBe(
              valueKind(value),
            );
            if (Array.isArray(value))
              expect(full[key], `${name}.${key}`).toHaveLength(value.length);
          }
        }
      } finally {
        await fixtures.prisma.todo.delete({ where: { id: todo.id } });
      }
    },
  );

  toolTest(
    "mcp.privacy-safe-default",
    { timeout: 30_000 },
    async ({ owner, reader, expect }) => {
      const secret = "private-calendar-credential-mode-test";
      await fixtures.prisma.user.update({
        where: { id: owner.userId },
        data: { calendarFeedToken: secret },
      });
      const ownerTodo = await fixtures.prisma.todo.create({
        data: {
          userId: owner.userId,
          title: "[integration-test] owner private todo marker",
          content: "owner private content marker",
        },
      });
      const readerTodo = await fixtures.prisma.todo.create({
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
      try {
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
              await fixtures.prisma.todo.findUnique({
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
      } finally {
        await fixtures.prisma.comment.deleteMany({ where: { id: comment.id } });
        await fixtures.prisma.todo.deleteMany({
          where: { id: { in: [ownerTodo.id, readerTodo.id] } },
        });
      }
    },
  );
});
