import { describe } from "vitest";
import {
  assertCommentRepliesPayload,
  assertCommentThreadFound,
} from "../../../shared/scenarios/comments";
import { catalogMcpTest as toolTest } from "../_harness/catalog-fixture";

describe("seeded-list MCP tools formerly E2E-only", () => {
  toolTest(
    "workspace_todo_list returns counts and incomplete seed todos",
    async ({ mcpActor: subscribed, isolatedDatabase, expect }) => {
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
    },
  );

  toolTest(
    "catalog_section_exam_list returns exams for the seed section",
    async ({ mcpActor: context, mcpCatalog, expect }) => {
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
    },
  );

  toolTest(
    "catalog_bus_route_search returns routes for seed campuses",
    async ({ mcpActor: context, mcpBus, expect }) => {
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
      expect(result.routes?.some((route) => route.id === mcpBus.routeId)).toBe(
        true,
      );
    },
  );

  toolTest(
    "community_comment_replies returns replies for a seed root comment",
    async ({ mcpActor: context, mcpCatalog, isolatedDatabase, expect }) => {
      const rootBody = "Private list consumer root";
      await isolatedDatabase.owner.$transaction(async (db) => {
        const root = await db.comment.create({
          data: {
            userId: context.userId,
            sectionId: mcpCatalog.section.id,
            body: rootBody,
          },
        });
        await db.comment.create({
          data: {
            userId: context.userId,
            sectionId: mcpCatalog.section.id,
            parentId: root.id,
            rootId: root.id,
            body: "Private list consumer reply",
          },
        });
      });
      const list = await context.client.call<{
        found?: boolean;
        data?: Array<{
          id?: string;
          body?: string;
          replies?: Array<{ id?: string }>;
        }>;
      }>("community_comment_list", {
        targetType: "section",
        sectionJwId: mcpCatalog.section.jwId,
        mode: "full",
      });

      const root = assertCommentThreadFound(list, rootBody);

      const replies = await context.client.call<{
        found?: boolean;
        rootId?: string;
        thread?: Array<{
          id?: string;
          body?: string;
          parentId?: string | null;
        }>;
      }>("community_comment_replies", {
        commentId: root.id,
        mode: "full",
      });

      const rootId = root.id;
      expect(typeof rootId).toBe("string");
      if (!rootId) {
        throw new Error("expected seed comment root id");
      }
      assertCommentRepliesPayload(replies, rootId);
    },
  );

  toolTest(
    "workspace_upload_list / workspace_homework_list / workspace_exam_list return arrays",
    async ({ mcpActor: subscribed, mcpCatalog, isolatedDatabase, expect }) => {
      const records = await isolatedDatabase.owner.$transaction(async (db) => {
        await db.userSectionSubscription.create({
          data: { userId: subscribed.userId, sectionId: mcpCatalog.section.id },
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
      });
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
    },
  );
});
