import { describe } from "vitest";
import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import { assertCommentThreadFound } from "../../../shared/scenarios/comments";
import { findCommentAuditLog } from "../_harness/audit-observer";
import { isolatedMcpTest } from "../_harness/isolated-context";

const readerTest = isolatedMcpTest.extend(
  "state",
  async ({ mcpWorkflow, signal, mcpActor: context, isolatedDatabase }) => {
    const setupResult = await mcpWorkflow.run(async () => {
      const catalog = await createCatalogContractFixture(
        isolatedDatabase.owner,
      );
      return isolatedDatabase.owner.$transaction(async (db) => {
        const rootBody = "Owned comment **Markdown**";
        const root = await db.comment.create({
          data: {
            userId: context.userId,
            sectionId: catalog.sections[0].id,
            body: rootBody,
          },
        });
        await db.comment.create({
          data: {
            userId: context.userId,
            sectionId: catalog.sections[0].id,
            parentId: root.id,
            rootId: root.id,
            body: "Owned reply **Markdown**",
          },
        });
        await db.commentReaction.create({
          data: { userId: context.userId, commentId: root.id, type: "upvote" },
        });
        return { catalog, rootId: root.id, rootBody };
      });
    });
    signal.throwIfAborted();
    return setupResult;
  },
);

describe("评论读取工具 — MCP 暴露 REST 评论层级", () => {
  readerTest(
    "comment.mcp-markdown-projection",
    async ({ mcpWorkflow, state, mcpActor: context, expect }) =>
      mcpWorkflow.run(async () => {
        const { catalog, rootBody } = state;

        type Result = {
          found?: boolean;
          data?: Array<{
            id?: string;
            body?: string;
            renderedBody?: string;
            author?: { name?: string | null } | null;
            replies?: Array<{ body?: string; renderedBody?: string }>;
            reactions?: Array<{ type?: string; count?: number }>;
            canReact?: boolean;
            canReply?: boolean;
            canEdit?: boolean;
            canDelete?: boolean;
          }>;
          meta?: {
            hiddenCount?: number;
            target?: {
              courseJwId?: number | null;
              courseName?: string | null;
              type?: string;
              targetId?: number | null;
              sectionJwId?: number | null;
              sectionCode?: string | null;
            };
            viewer?: { userId?: string | null; isAuthenticated?: boolean };
          };
          pagination?: { page?: number; pageSize?: number; total?: number };
        };

        const results = await Promise.all(
          (["default", "full"] as const).map(async (mode) => ({
            mode,
            result: await context.client.call<Result>(
              "community_comment_list",
              {
                targetType: "section",
                sectionJwId: catalog.sections[0].jwId,
                mode,
              },
            ),
          })),
        );
        const result = results.find(({ mode }) => mode === "full")?.result;
        if (!result)
          throw new Error("Missing full-mode community_comment_list result");

        expect(result.found).toBe(true);
        expect(result.meta?.target?.type).toBe("section");
        expect(typeof result.meta?.target?.targetId).toBe("number");
        expect(result.meta?.target?.sectionJwId).toBe(catalog.sections[0].jwId);
        expect(result.meta?.target?.sectionCode).toBe(catalog.sections[0].code);
        expect(result.meta?.target?.courseJwId).toBe(catalog.courses[0].jwId);
        expect(result.meta?.target?.courseName).toBe(catalog.courses[0].nameCn);
        expect(result.meta?.viewer?.userId).toBe(context.userId);
        expect(result.meta?.viewer?.isAuthenticated).toBe(true);
        expect(typeof result.meta?.hiddenCount).toBe("number");
        expect(result.pagination).toMatchObject({ page: 1, pageSize: 20 });

        const root = assertCommentThreadFound(result, rootBody);
        expect(root.author?.name).toBe(context.name);
        expect(root?.canReact).toBe(true);
        expect(root?.canReply).toBe(true);
        expect(root?.canEdit).toBe(true);
        expect(root?.canDelete).toBe(true);
        expect(root?.replies?.length).toBeGreaterThan(0);
        expect(
          root?.reactions?.some(
            (reaction) => reaction.type === "upvote" && reaction.count === 1,
          ),
        ).toBe(true);

        for (const { mode, result: modeResult } of results) {
          const modeRoot = modeResult.data?.find((comment) =>
            comment.body?.includes(rootBody),
          );
          expect(modeRoot).toBeDefined();
          expect(modeRoot?.body).toBe(root.body);
          expect(modeRoot?.replies?.[0]?.body).toBe(root.replies?.[0]?.body);
          if (mode === "full") {
            expect(modeRoot?.renderedBody).toContain("Owned comment");
            expect(modeRoot?.renderedBody).toContain(
              "<strong>Markdown</strong>",
            );
            expect(modeRoot?.replies?.[0]?.renderedBody).toBeTruthy();
          }
          expect(Object.hasOwn(modeRoot ?? {}, "renderedBody")).toBe(
            mode === "full",
          );
          expect(
            Object.hasOwn(modeRoot?.replies?.[0] ?? {}, "renderedBody"),
          ).toBe(mode === "full");
        }
      }),
  );

  readerTest(
    "community_comment_get 返回聚焦线程及目标元数据",
    async ({
      mcpWorkflow,
      state,
      mcpActor: context,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog, rootId, rootBody } = state;

        const seedComment = await db.comment.findFirst({
          where: { id: rootId },
          select: { id: true },
        });
        expect(seedComment?.id).toBeTruthy();

        type Result = {
          found?: boolean;
          focusId?: string;
          thread?: Array<{
            id?: string;
            body?: string;
            renderedBody?: string;
            replies?: Array<{ body?: string; renderedBody?: string }>;
          }>;
          target?: {
            courseJwId?: number | null;
            courseName?: string | null;
            sectionJwId?: number | null;
            sectionCode?: string | null;
          };
        };
        const results = await Promise.all(
          (["default", "full"] as const).map(async (mode) => ({
            mode,
            result: await context.client.call<Result>("community_comment_get", {
              commentId: seedComment?.id,
              mode,
            }),
          })),
        );
        const result = results.find(({ mode }) => mode === "full")?.result;
        if (!result) throw new Error("Missing full-mode comment thread result");

        expect(result.found).toBe(true);
        expect(result.focusId).toBe(seedComment?.id);
        expect(result.thread?.[0]?.id).toBe(seedComment?.id);
        expect(result.thread?.[0]?.body).toContain(rootBody);
        expect(result.thread?.[0]?.replies?.length).toBeGreaterThan(0);
        expect(result.target?.sectionJwId).toBe(catalog.sections[0].jwId);
        expect(result.target?.sectionCode).toBe(catalog.sections[0].code);
        expect(result.target?.courseJwId).toBe(catalog.courses[0].jwId);
        expect(result.target?.courseName).toBe(catalog.courses[0].nameCn);

        for (const { mode, result: modeResult } of results) {
          expect(
            Object.hasOwn(modeResult.thread?.[0] ?? {}, "renderedBody"),
          ).toBe(mode === "full");
          expect(
            Object.hasOwn(
              modeResult.thread?.[0]?.replies?.[0] ?? {},
              "renderedBody",
            ),
          ).toBe(mode === "full");
        }
      }),
  );

  readerTest(
    "community_comment_list 报告缺失目标而非返回空成功",
    async ({ mcpWorkflow, mcpActor: context, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await context.client.call<{
          success?: boolean;
          found?: boolean;
          error?: string;
        }>("community_comment_list", {
          targetType: "section",
          sectionJwId: 2_147_483_647,
        });

        expect(result.success).toBe(false);
        expect(result.found).toBe(false);
        expect(result.error).toBe("target_not_found");
      }),
  );
});

describe("评论读取工具 — 隔离目录夹具", () => {
  const ownershipTest = readerTest;

  ownershipTest(
    "community_comment_list 将未关联的班级-教师对报告为缺失目标",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-section-teacher-missing-${Date.now()}`;
        const teacher = await db.teacher.create({
          data: {
            code: marker,
            jwId: 2_120_000_000 + (Date.now() % 10_000_000),
            nameCn: marker,
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          success?: boolean;
          found?: boolean;
          error?: string;
        }>("community_comment_list", {
          targetType: "section-teacher",
          sectionJwId: catalog.sections[0].jwId,
          teacherId: teacher.id,
        });

        expect(result.success).toBe(false);
        expect(result.found).toBe(false);
        expect(result.error).toBe("target_not_found");
      }),
  );

  ownershipTest(
    "comment.read-target-nonmutation",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpRuntime,
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-section-teacher-read-${Date.now()}`;
        const sectionJwId = 2_100_000_000 + (Date.now() % 10_000_000);
        let sectionId: number | null = null;
        let teacherId: number | null = null;

        const course = await db.course.findUnique({
          where: { jwId: catalog.courses[0].jwId },
          select: { id: true },
        });
        if (!course) {
          throw new Error(`Seed course ${catalog.courses[0].jwId} not found`);
        }

        const semester = await db.semester.findUnique({
          where: { jwId: catalog.semester.jwId },
          select: { id: true },
        });
        if (!semester) {
          throw new Error(`Seed semester ${catalog.semester.jwId} not found`);
        }

        const teacher = await db.teacher.create({
          data: {
            code: marker,
            jwId: sectionJwId,
            nameCn: marker,
          },
          select: { id: true },
        });
        teacherId = teacher.id;

        const section = await db.section.create({
          data: {
            jwId: sectionJwId,
            code: `${marker}.01`,
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacherId } },
          },
          select: { id: true },
        });
        sectionId = section.id;

        const before = await db.sectionTeacher.findUnique({
          where: {
            sectionId_teacherId: {
              sectionId,
              teacherId,
            },
          },
          select: { id: true },
        });
        expect(before).toBeNull();

        const result = await isolated.client.call<{
          data?: unknown[];
          found?: boolean;
          meta?: {
            target?: {
              sectionId?: number | null;
              sectionTeacherId?: number | null;
              teacherId?: number | null;
            };
          };
        }>("community_comment_list", {
          targetType: "section-teacher",
          sectionJwId,
          teacherId,
        });

        expect(result.found).toBe(true);
        expect(result.data).toEqual([]);
        expect(result.meta?.target?.sectionId).toBe(sectionId);
        expect(result.meta?.target?.teacherId).toBe(teacherId);
        expect(result.meta?.target?.sectionTeacherId).toBeNull();
        const response = await mcpRuntime.run(() =>
          getCommentsRoute(
            new Request(
              `http://localhost:3000/api/community/comments?targetType=section-teacher&sectionJwId=${sectionJwId}&teacherId=${teacherId}`,
            ),
          ),
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          data: [],
          pagination: { total: 0 },
        });
        const resolved = await mcpRuntime.run(() =>
          resolveCommentTargetReference({
            targetType: "section-teacher",
            sectionJwId,
            teacherId,
            verifyExistence: true,
            includeTargetMetadata: true,
          }),
        );
        if (!resolved.ok) throw new Error("Expected existing relationship");
        const web = await mcpRuntime.run(() =>
          loadCommentThread({
            target: resolved.target,
            viewerUserId: isolated.userId,
            pagination: { pageSize: 20, skip: 0 },
          }),
        );
        expect(web.comments).toEqual([]);
        expect(web.total).toBe(0);

        const after = await db.sectionTeacher.findUnique({
          where: {
            sectionId_teacherId: {
              sectionId,
              teacherId,
            },
          },
          select: { id: true },
        });
        expect(after).toBeNull();
      }),
  );

  ownershipTest(
    "community_comment_list 保留 active/retired 班级-教师目标合同",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-section-teacher-lifecycle-${Date.now()}`;
        const sectionJwId = 2_110_000_000 + (Date.now() % 10_000_000);
        let sectionId: number | null = null;
        let teacherId: number | null = null;
        let sectionTeacherId: number | null = null;

        const course = await db.course.findUnique({
          where: { jwId: catalog.courses[0].jwId },
          select: { id: true },
        });
        if (!course) {
          throw new Error(`Seed course ${catalog.courses[0].jwId} not found`);
        }

        const semester = await db.semester.findUnique({
          where: { jwId: catalog.semester.jwId },
          select: { id: true },
        });
        if (!semester) {
          throw new Error(`Seed semester ${catalog.semester.jwId} not found`);
        }

        const teacher = await db.teacher.create({
          data: {
            code: marker,
            jwId: sectionJwId,
            nameCn: marker,
          },
          select: { id: true },
        });
        teacherId = teacher.id;

        const section = await db.section.create({
          data: {
            jwId: sectionJwId,
            code: `${marker}.01`,
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacherId } },
          },
          select: { id: true },
        });
        sectionId = section.id;

        const active = await db.sectionTeacher.create({
          data: { sectionId, teacherId },
          select: { id: true },
        });
        sectionTeacherId = active.id;

        type Result = {
          data?: unknown[];
          error?: string;
          found?: boolean;
          meta?: {
            target?: {
              sectionId?: number | null;
              sectionTeacherId?: number | null;
              targetId?: number | null;
              teacherId?: number | null;
            };
          };
          success?: boolean;
        };

        const activeResult = await isolated.client.call<Result>(
          "community_comment_list",
          {
            targetType: "section-teacher",
            sectionJwId,
            teacherId,
          },
        );
        expect(activeResult.found).toBe(true);
        expect(activeResult.data).toEqual([]);
        expect(activeResult.meta?.target).toMatchObject({
          sectionId,
          sectionTeacherId,
          targetId: null,
          teacherId,
        });

        await db.sectionTeacher.update({
          where: { id: active.id },
          data: { retiredAt: new Date("2026-01-01T00:00:00.000Z") },
        });

        const retiredResult = await isolated.client.call<Result>(
          "community_comment_list",
          {
            targetType: "section-teacher",
            sectionJwId,
            teacherId,
          },
        );
        expect(retiredResult.found).toBe(true);
        expect(retiredResult.data).toEqual([]);
        expect(retiredResult.meta?.target).toMatchObject({
          sectionId,
          sectionTeacherId: null,
          targetId: null,
          teacherId,
        });

        const directRetiredResult = await isolated.client.call<Result>(
          "community_comment_list",
          {
            targetType: "section-teacher",
            sectionTeacherId,
          },
        );
        expect(directRetiredResult.success).toBe(false);
        expect(directRetiredResult.found).toBe(false);
        expect(directRetiredResult.error).toBe("target_not_found");
      }),
  );
});

describe("评论写入工具 — MCP 镜像普通用户 REST 写入", () => {
  const mutationTest = readerTest;

  mutationTest(
    "comment.mcp-write-audit-source",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-write-${Date.now()}`;

        const created = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} created`,
          visibility: "public",
          isAnonymous: false,
        });

        expect(created.success).toBe(true);
        expect(typeof created.id).toBe("string");
        const commentId = created.id;
        if (!commentId) {
          throw new Error("community_comment_create returned no comment id");
        }

        const createAudit = await findCommentAuditLog(db, {
          expect,
          action: "comment_create",
          commentId,
          metadata: { source: "mcp" },
          userId: isolated.userId,
        });
        expect(createAudit?.metadata).toMatchObject({
          source: "mcp",
        });
        expect(JSON.stringify(createAudit?.metadata)).not.toContain(marker);

        const updated = await isolated.client.call<{
          success?: boolean;
          comment?: {
            id?: string;
            body?: string;
            isAnonymous?: boolean;
            visibility?: string;
            canEdit?: boolean;
          };
        }>("community_comment_update", {
          commentId,
          body: `${marker} updated`,
          visibility: "logged_in_only",
          isAnonymous: true,
          mode: "full",
        });

        expect(updated.success).toBe(true);
        expect(updated.comment).toMatchObject({
          id: commentId,
          body: `${marker} updated`,
          isAnonymous: true,
          visibility: "logged_in_only",
          canEdit: true,
        });

        const editAudit = await findCommentAuditLog(db, {
          expect,
          action: "comment_edit",
          commentId,
          metadata: { source: "mcp" },
          userId: isolated.userId,
        });
        expect(editAudit?.metadata).toMatchObject({
          source: "mcp",
        });
        expect(JSON.stringify(editAudit?.metadata)).not.toContain(marker);

        const addedReaction = await isolated.client.call<{
          success?: boolean;
          changed?: boolean;
        }>("community_comment_reaction_add", {
          commentId,
          type: "heart",
        });

        expect(addedReaction).toEqual({ success: true, changed: true });

        const addReactionAudit = await findCommentAuditLog(db, {
          expect,
          action: "comment_react",
          commentId,
          metadata: { operation: "add", source: "mcp", type: "heart" },
          userId: isolated.userId,
        });
        expect(addReactionAudit?.metadata).toMatchObject({
          operation: "add",
          source: "mcp",
          type: "heart",
        });

        const removedReaction = await isolated.client.call<{
          success?: boolean;
          changed?: boolean;
        }>("community_comment_reaction_remove", {
          commentId,
          type: "heart",
        });

        expect(removedReaction).toEqual({ success: true, changed: true });

        const removeReactionAudit = await findCommentAuditLog(db, {
          expect,
          action: "comment_react",
          commentId,
          metadata: { operation: "remove", source: "mcp", type: "heart" },
          userId: isolated.userId,
        });
        expect(removeReactionAudit?.metadata).toMatchObject({
          operation: "remove",
          source: "mcp",
          type: "heart",
        });

        const deleted = await isolated.client.call<{ success?: boolean }>(
          "community_comment_delete",
          { commentId },
        );

        expect(deleted).toEqual({ success: true });

        const deleteAudit = await findCommentAuditLog(db, {
          expect,
          action: "comment_delete",
          commentId,
          metadata: { source: "mcp" },
          userId: isolated.userId,
        });
        expect(deleteAudit?.metadata).toMatchObject({ source: "mcp" });
      }),
  );

  mutationTest(
    "评论写入工具拒绝不支持的匿名可见性",
    async ({ mcpWorkflow, state, mcpOtherActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        await expect(
          isolated.client.call("community_comment_create", {
            targetType: "section",
            sectionJwId: catalog.sections[0].jwId,
            body: `[integration-test] rejected anonymous visibility ${Date.now()}`,
            visibility: "anonymous",
          }),
        ).rejects.toThrow();
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 返回序列化的无效目标失败",
    async ({ mcpWorkflow, mcpOtherActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          success?: boolean;
          found?: boolean;
          error?: string;
          message?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: 2_147_483_647,
          body: "[integration-test] invalid mcp comment target",
        });

        expect(result.success).toBe(false);
        expect(result.found).toBe(false);
        expect(result.error).toBe("target_not_found");
        expect(result.message).toContain("section");
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 支持通过公共 MCP 接口回复",
    async ({ mcpWorkflow, state, mcpOtherActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-reply-${Date.now()}`;

        const parent = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} parent`,
        });
        expect(parent.success).toBe(true);
        expect(typeof parent.id).toBe("string");

        const reply = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          parentId: parent.id,
          body: `${marker} reply`,
        });
        expect(reply.success).toBe(true);
        expect(typeof reply.id).toBe("string");

        const thread = await isolated.client.call<{
          found?: boolean;
          focusId?: string;
          thread?: unknown;
        }>("community_comment_get", {
          commentId: reply.id,
          mode: "full",
        });
        expect(thread.found).toBe(true);
        expect(thread.focusId).toBe(reply.id);
        expect(JSON.stringify(thread.thread)).toContain(reply.id ?? "");
      }),
  );

  mutationTest(
    "评论写入工具拒绝非所有者编辑和删除尝试",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      mcpActor: context,
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-non-owner-${Date.now()}`;
        const otherUser = context;

        const created = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} owned`,
        });
        expect(created.success).toBe(true);
        const commentId = created.id;
        expect(typeof commentId).toBe("string");

        const update = await otherUser.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_update", {
          commentId,
          body: `${marker} stolen edit`,
        });
        expect(update).toMatchObject({
          success: false,
          error: "forbidden",
        });

        const deletion = await otherUser.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_delete", { commentId });
        expect(deletion).toMatchObject({
          success: false,
          error: "forbidden",
        });
      }),
  );

  mutationTest(
    "评论写入工具校验现有上传附件",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-attachments-${Date.now()}`;
        const filename = `mcp-comment-attachment-${Date.now()}.txt`;
        const upload = await db.upload.create({
          data: {
            userId: isolated.userId,
            key: `integration-test/${filename}`,
            filename,
            contentType: "text/plain",
            size: 128,
          },
          select: { id: true, filename: true },
        });
        const otherUser = await db.user.create({
          data: {
            email: "attachment-owner@example.test",
            name: "MCP Comment Attachment Owner",
          },
          select: { id: true },
        });
        const otherUpload = await db.upload.create({
          data: {
            userId: otherUser.id,
            key: `integration-test/other-${filename}`,
            filename: `other-${filename}`,
            contentType: "text/plain",
            size: 256,
          },
          select: { id: true },
        });

        const created = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} attached`,
          attachmentIds: [upload.id],
        });
        expect(created.success).toBe(true);
        const commentId = created.id;
        expect(typeof commentId).toBe("string");

        const thread = await isolated.client.call<{
          found?: boolean;
          thread?: unknown;
        }>("community_comment_get", {
          commentId,
          mode: "full",
        });
        expect(thread.found).toBe(true);
        expect(JSON.stringify(thread.thread)).toContain(upload.filename);

        const invalidUpdate = await isolated.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_update", {
          commentId,
          body: `${marker} invalid attachment`,
          attachmentIds: [otherUpload.id],
        });
        expect(invalidUpdate).toMatchObject({
          success: false,
          error: "invalid_attachments",
        });
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 在目标查找前检查封禁状态",
    async ({
      mcpWorkflow,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const suspendedUser = await db.user.create({
          data: {
            email: "suspended@example.test",
            name: "MCP Comment Suspended",
          },
          select: { id: true },
        });
        await db.userSuspension.create({
          data: {
            userId: suspendedUser.id,
            createdById: isolated.userId,
            reason: "integration suspended",
          },
          select: { id: true },
        });
        const suspendedSession = mcpSessions.own(suspendedUser.id);
        await suspendedSession.initialize();
        const suspendedMcp = suspendedSession.client;

        const result = await suspendedMcp.call<{
          success?: boolean;
          error?: string;
          reason?: string | null;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: 2_147_483_647,
          body: "[integration-test] suspended invalid target",
        });

        expect(result).toMatchObject({
          success: false,
          error: "suspended",
          reason: "integration suspended",
        });
      }),
  );

  mutationTest(
    "评论写入工具拒绝已删除评论的回复和反应",
    async ({ mcpWorkflow, state, mcpOtherActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-locked-${Date.now()}`;

        const created = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} deleted`,
        });
        expect(created.success).toBe(true);
        const commentId = created.id;
        expect(typeof commentId).toBe("string");

        await expect(
          isolated.client.call<{ success?: boolean }>(
            "community_comment_delete",
            {
              commentId,
            },
          ),
        ).resolves.toEqual({ success: true });

        const repeatedDelete = await isolated.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_delete", { commentId });
        expect(repeatedDelete).toMatchObject({
          success: false,
          error: "locked",
        });

        const reply = await isolated.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          parentId: commentId,
          body: `${marker} rejected reply`,
        });
        expect(reply).toMatchObject({ success: false, error: "locked" });

        const reaction = await isolated.client.call<{
          success?: boolean;
          error?: string;
        }>("community_comment_reaction_add", {
          commentId,
          type: "heart",
        });
        expect(reaction).toMatchObject({ success: false, error: "locked" });
      }),
  );

  mutationTest(
    "评论写入工具拒绝软封禁评论的所有者删除",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const { catalog } = state;

        const marker = `[integration-test] mcp-comment-softbanned-delete-${Date.now()}`;

        const created = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: catalog.sections[0].jwId,
          body: `${marker} locked`,
        });
        expect(created.success).toBe(true);
        const commentId = created.id;
        expect(typeof commentId).toBe("string");

        await db.comment.update({
          where: { id: commentId },
          data: { status: "softbanned" },
        });

        const deletion = await isolated.client.call<{
          success?: boolean;
          error?: string;
          message?: string;
        }>("community_comment_delete", { commentId });

        expect(deletion).toMatchObject({
          success: false,
          error: "locked",
          message: "Comment locked",
        });
      }),
  );
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------
