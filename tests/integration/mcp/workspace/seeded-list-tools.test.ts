import { describe } from "vitest";
import { catalogMcpTest as toolTest } from "../_harness/catalog-fixture";

describe("seeded-list MCP tools formerly E2E-only", () => {
  toolTest(
    "workspace_todo_list returns counts and incomplete seed todos",
    async ({ mcpWorkflow, mcpActor: subscribed, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        await isolatedDatabase.owner.todo.create({
          data: {
            userId: subscribed.userId,
            title: "Private incomplete todo",
            completed: false,
          },
        });
        const result = await subscribed.client.call<{
          counts?: {
            incomplete?: number;
            completed?: number;
            overdue?: number;
          };
          todos?: Array<{ title?: string; completed?: boolean }>;
        }>("workspace_todo_list", {});

        expect(typeof result.counts?.incomplete).toBe("number");
        expect(typeof result.counts?.completed).toBe("number");
        expect(Array.isArray(result.todos)).toBe(true);
        expect(result.counts?.incomplete).toBe(1);
        expect(result.counts?.completed).toBe(0);
        expect(result.todos).toEqual([
          expect.objectContaining({
            title: "Private incomplete todo",
            completed: false,
          }),
        ]);
      }),
  );

  toolTest(
    "catalog_section_exam_list returns exams for the seed section",
    async ({ mcpWorkflow, mcpActor: context, mcpCatalog, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          found?: boolean;
          section?: { jwId?: number };
          exams?: Array<{ id?: number }>;
        }>("catalog_section_exam_list", {
          sectionJwId: mcpCatalog.section.jwId,
          locale: "zh-cn",
        });

        expect(result.found).toBe(true);
        expect(result.section?.jwId).toBe(mcpCatalog.section.jwId);
        expect((result.exams?.length ?? 0) > 0).toBe(true);
      }),
  );

  toolTest(
    "catalog_bus_route_search returns routes for seed campuses",
    async ({ mcpWorkflow, mcpActor: context, mcpBus, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          total?: number;
          routes?: Array<{ id?: number }>;
          hasData?: boolean;
        }>("catalog_bus_route_search", {
          originCampusId: mcpBus.originCampusId,
          destinationCampusId: mcpBus.destinationCampusId,
          locale: "zh-cn",
        });

        expect(Array.isArray(result.routes)).toBe(true);
        expect((result.total ?? 0) > 0).toBe(true);
        expect(
          result.routes?.some((route) => route.id === mcpBus.routeId),
        ).toBe(true);
      }),
  );

  toolTest(
    "community_comment_replies returns replies for a seed root comment",
    async ({
      mcpWorkflow,
      mcpActor: context,
      mcpCatalog,
      isolatedDatabase,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const { root, reply } = await isolatedDatabase.owner.$transaction(
          async (db) => {
            const root = await db.comment.create({
              data: {
                userId: context.userId,
                sectionId: mcpCatalog.section.id,
                body: "Private list consumer root",
              },
            });
            const reply = await db.comment.create({
              data: {
                userId: context.userId,
                sectionId: mcpCatalog.section.id,
                parentId: root.id,
                rootId: root.id,
                body: "Private list consumer reply",
              },
            });
            return { root, reply };
          },
        );
        const result = await context.client.call<{
          found?: boolean;
          rootId?: string;
          thread?: Array<{
            id?: string;
            body?: string;
            replies?: Array<{
              id?: string;
              body?: string;
              parentId?: string | null;
            }>;
          }>;
        }>("community_comment_replies", { commentId: root.id, mode: "full" });
        expect(result.found).toBe(true);
        expect(result.rootId).toBe(root.id);
        expect(result.thread).toEqual([
          expect.objectContaining({
            id: root.id,
            body: root.body,
            replies: [
              expect.objectContaining({
                id: reply.id,
                body: reply.body,
                parentId: root.id,
              }),
            ],
          }),
        ]);
      }),
  );

  toolTest(
    "workspace_upload_list / workspace_homework_list / workspace_exam_list return arrays",
    async ({
      mcpWorkflow,
      mcpActor: subscribed,
      mcpCatalog,
      isolatedDatabase,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const records = await isolatedDatabase.owner.$transaction(
          async (db) => {
            await db.userSectionSubscription.create({
              data: {
                userId: subscribed.userId,
                sectionId: mcpCatalog.section.id,
              },
            });
            const upload = await db.upload.create({
              data: {
                userId: subscribed.userId,
                key: "private/list.txt",
                filename: "list.txt",
                contentType: "text/plain",
                size: 12,
              },
            });
            const homework = await db.homework.create({
              data: {
                createdById: subscribed.userId,
                sectionId: mcpCatalog.section.id,
                title: "Private list homework",
              },
            });
            return { upload, homework };
          },
        );
        const [uploads, homeworks, exams] = await Promise.all([
          subscribed.client.call<{
            data?: unknown[];
            meta?: { usedBytes?: number };
          }>("workspace_upload_list", {}),
          subscribed.client.call<{
            homeworks?: unknown[];
          }>("workspace_homework_list", {
            completed: false,
            limit: 10,
            locale: "zh-cn",
          }),
          subscribed.client.call<{
            exams?: unknown[];
          }>("workspace_exam_list", {
            limit: 10,
            locale: "zh-cn",
          }),
        ]);

        expect(Array.isArray(uploads.data)).toBe(true);
        expect(Array.isArray(homeworks.homeworks)).toBe(true);
        expect(Array.isArray(exams.exams)).toBe(true);
        expect(uploads.data).toContainEqual(
          expect.objectContaining({ id: records.upload.id }),
        );
        expect(homeworks.homeworks).toContainEqual(
          expect.objectContaining({ id: records.homework.id }),
        );
        expect(exams.exams).toContainEqual(
          expect.objectContaining({ id: mcpCatalog.exam.id }),
        );
      }),
  );
});
