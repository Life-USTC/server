import { describe } from "vitest";
import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../../shared/prisma";
import { assertCommentThreadFound } from "../../../shared/scenarios/comments";
import { isolatedMcpTest } from "../_harness/isolated-context";

// Only persisted observations; expected transitions remain in each operation case.
function readCommentState(db: TestPrismaClient) {
  return db.$transaction(async (tx) => ({
    comments: await tx.comment.findMany({
      orderBy: { id: "asc" },
      include: {
        attachments: { orderBy: { id: "asc" } },
        reactions: { orderBy: { id: "asc" } },
      },
    }),
    uploads: await tx.upload.findMany({ orderBy: { id: "asc" } }),
    audits: await tx.auditLog.findMany({ orderBy: { id: "asc" } }),
  }));
}

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
        const reply = await db.comment.create({
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
        return { catalog, rootId: root.id, rootBody, replyId: reply.id };
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
        const { catalog, rootId, rootBody, replyId } = state;

        const upload = await db.upload.create({
          data: {
            userId: context.userId,
            key: `mcp-comment-read/${crypto.randomUUID()}`,
            filename: "Known focused comment attachment.txt",
            contentType: "text/plain",
            size: 128,
            commentAttachments: { create: { commentId: rootId } },
          },
        });
        const before = await readCommentState(db);

        type Result = {
          found?: boolean;
          focusId?: string;
          thread?: Array<{
            id?: string;
            body?: string;
            renderedBody?: string;
            replies?: Array<{
              id?: string;
              body?: string;
              renderedBody?: string;
            }>;
            attachments?: Array<{ filename?: string }>;
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
              commentId: replyId,
              mode,
            }),
          })),
        );
        const result = results.find(({ mode }) => mode === "full")?.result;
        if (!result) throw new Error("Missing full-mode comment thread result");

        expect(result.found).toBe(true);
        expect(result.focusId).toBe(replyId);
        expect(result.thread?.[0]?.id).toBe(rootId);
        expect(result.thread?.[0]?.body).toContain(rootBody);
        expect(result.thread?.[0]?.replies).toEqual([
          expect.objectContaining({
            id: replyId,
            body: "Owned reply **Markdown**",
          }),
        ]);
        expect(result.thread?.[0]?.attachments).toEqual([
          expect.objectContaining({ filename: upload.filename }),
        ]);
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
        expect(await readCommentState(db)).toEqual(before);
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

  for (const operation of [
    "create",
    "update",
    "add reaction",
    "remove reaction",
    "delete",
  ] as const) {
    mutationTest(
      `comment.mcp-write-audit-source ${operation}`,
      async ({
        mcpWorkflow,
        state,
        mcpActor: other,
        mcpOtherActor: actor,
        expect,
        isolatedDatabase: { owner: db },
      }) =>
        mcpWorkflow.run(async () => {
          const marker = `[integration-test] independent MCP ${operation}`;
          const prepared =
            operation === "create"
              ? null
              : await db.comment.create({
                  data: {
                    userId: actor.userId,
                    sectionId: state.catalog.sections[0].id,
                    body: `${marker} prepared`,
                    visibility:
                      operation === "update" ? "public" : "logged_in_only",
                    isAnonymous: operation !== "update",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    updatedAt: new Date("2026-01-01T00:00:00Z"),
                    ...(operation === "add reaction" ||
                    operation === "remove reaction"
                      ? {
                          reactions: {
                            create: [
                              { userId: other.userId, type: "heart" as const },
                              ...(operation === "remove reaction"
                                ? [
                                    {
                                      userId: actor.userId,
                                      type: "heart" as const,
                                    },
                                  ]
                                : []),
                            ],
                          },
                        }
                      : {}),
                  },
                });
          const before = await readCommentState(db);
          let commentId: string;
          let action:
            | "comment_create"
            | "comment_edit"
            | "comment_react"
            | "comment_delete";
          let metadata: Record<string, unknown> = { source: "mcp" };
          let editedAt: Date | undefined;
          if (operation === "create") {
            const result = await actor.client.call<{
              success: boolean;
              id: string;
            }>("community_comment_create", {
              targetType: "section",
              sectionJwId: state.catalog.sections[0].jwId,
              body: `${marker} created`,
              visibility: "public",
              isAnonymous: false,
            });
            expect(result.success).toBe(true);
            expect(result.id).toEqual(expect.any(String));
            commentId = result.id;
            action = "comment_create";
          } else {
            if (!prepared)
              throw new Error("Expected independently seeded mutation target");
            commentId = prepared.id;
            if (operation === "update") {
              const result = await actor.client.call<{
                success: boolean;
                comment: {
                  id: string;
                  body: string;
                  isAnonymous: boolean;
                  visibility: string;
                  canEdit: boolean;
                  updatedAt: string;
                };
              }>("community_comment_update", {
                commentId,
                body: `${marker} updated`,
                visibility: "logged_in_only",
                isAnonymous: true,
                mode: "full",
              });
              expect(result.success).toBe(true);
              expect(result.comment).toMatchObject({
                id: commentId,
                body: `${marker} updated`,
                isAnonymous: true,
                visibility: "logged_in_only",
                canEdit: true,
              });
              editedAt = new Date(result.comment.updatedAt);
              action = "comment_edit";
            } else if (operation === "delete") {
              expect(
                await actor.client.call("community_comment_delete", {
                  commentId,
                }),
              ).toEqual({ success: true });
              action = "comment_delete";
            } else {
              const removing = operation === "remove reaction";
              expect(
                await actor.client.call(
                  removing
                    ? "community_comment_reaction_remove"
                    : "community_comment_reaction_add",
                  { commentId, type: "heart" },
                ),
              ).toEqual({ success: true, changed: true });
              action = "comment_react";
              metadata = {
                operation: removing ? "remove" : "add",
                source: "mcp",
                type: "heart",
              };
            }
          }
          const after = await readCommentState(db);
          const saved = after.comments.find((row) => row.id === commentId);
          const prior = before.comments.find((row) => row.id === commentId);
          expect(after.comments.filter((row) => row.id !== commentId)).toEqual(
            before.comments.filter((row) => row.id !== commentId),
          );
          expect(after.uploads).toEqual(before.uploads);
          if (operation === "create") {
            expect(saved).toMatchObject({
              id: commentId,
              rootId: commentId,
              parentId: null,
              userId: actor.userId,
              sectionId: state.catalog.sections[0].id,
              body: `${marker} created`,
              status: "active",
              visibility: "public",
              isAnonymous: false,
              attachments: [],
              reactions: [],
            });
          } else if (operation === "update") {
            expect(saved).toEqual({
              ...prior,
              body: `${marker} updated`,
              visibility: "logged_in_only",
              isAnonymous: true,
              updatedAt: editedAt,
            });
            expect(saved?.updatedAt.getTime()).toBeGreaterThan(
              new Date("2026-01-01T00:00:00Z").getTime(),
            );
          } else if (operation === "delete") {
            expect(saved).toEqual({
              ...prior,
              status: "deleted",
              deletedAt: expect.any(Date),
              updatedAt: expect.any(Date),
            });
          } else {
            const reactions =
              operation === "remove reaction"
                ? prior?.reactions.filter((row) => row.userId !== actor.userId)
                : expect.arrayContaining([
                    ...(prior?.reactions ?? []),
                    expect.objectContaining({
                      commentId,
                      userId: actor.userId,
                      type: "heart",
                    }),
                  ]);
            expect(saved).toEqual({ ...prior, reactions });
            expect(saved?.reactions).toHaveLength(
              operation === "remove reaction" ? 1 : 2,
            );
          }
          expect(after.audits).toHaveLength(before.audits.length + 1);
          const [audit] = after.audits.filter(
            (row) => !before.audits.some((old) => old.id === row.id),
          );
          expect(audit).toMatchObject({
            action,
            targetId: commentId,
            targetType: "comment",
            userId: actor.userId,
            outcome: "success",
            metadata,
          });
          expect(JSON.stringify(audit.metadata)).not.toContain(marker);
        }),
    );
  }

  mutationTest(
    "评论写入工具拒绝不支持的匿名可见性",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const before = await readCommentState(db);
        await expect(
          actor.client.call("community_comment_create", {
            targetType: "section",
            sectionJwId: state.catalog.sections[0].jwId,
            body: "[integration-test] rejected anonymous visibility",
            visibility: "anonymous",
          }),
        ).rejects.toThrow();
        expect(await readCommentState(db)).toEqual(before);
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 返回序列化的无效目标失败",
    async ({
      mcpWorkflow,
      mcpOtherActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const before = await readCommentState(db);
        const result = await actor.client.call<{
          success: boolean;
          found: boolean;
          error: string;
          message: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: 2_147_483_647,
          body: "[integration-test] invalid mcp comment target",
        });
        expect(result).toMatchObject({
          success: false,
          found: false,
          error: "target_not_found",
        });
        expect(result.message).toContain("section");
        expect(await readCommentState(db)).toEqual(before);
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 支持通过公共 MCP 接口回复",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const before = await readCommentState(db);
        const body = "[integration-test] reply to independently seeded parent";
        const reply = await actor.client.call<{ success: boolean; id: string }>(
          "community_comment_create",
          {
            targetType: "section",
            sectionJwId: state.catalog.sections[0].jwId,
            parentId: state.rootId,
            body,
          },
        );
        expect(reply.success).toBe(true);
        expect(reply.id).toEqual(expect.any(String));
        const after = await readCommentState(db);
        expect(after.comments.find((row) => row.id === reply.id)).toMatchObject(
          {
            userId: actor.userId,
            body,
            sectionId: state.catalog.sections[0].id,
            parentId: state.rootId,
            rootId: state.rootId,
            status: "active",
            attachments: [],
            reactions: [],
          },
        );
        expect(after.comments.filter((row) => row.id !== reply.id)).toEqual(
          before.comments,
        );
        expect(after.uploads).toEqual(before.uploads);
        expect(after.audits).toHaveLength(before.audits.length + 1);
        expect(
          after.audits.find((row) => row.targetId === reply.id),
        ).toMatchObject({ action: "comment_create", userId: actor.userId });
      }),
  );

  for (const operation of ["update", "delete"] as const) {
    mutationTest(
      `评论写入工具拒绝非所有者 ${operation}`,
      async ({
        mcpWorkflow,
        state,
        mcpOtherActor: actor,
        expect,
        isolatedDatabase: { owner: db },
      }) =>
        mcpWorkflow.run(async () => {
          const before = await readCommentState(db);
          const result = await actor.client.call(
            `community_comment_${operation}`,
            {
              commentId: state.rootId,
              ...(operation === "update"
                ? { body: "[integration-test] stolen edit" }
                : {}),
            },
          );
          expect(result).toMatchObject({ success: false, error: "forbidden" });
          expect(await readCommentState(db)).toEqual(before);
        }),
    );
  }

  mutationTest(
    "评论写入工具创建评论时绑定已有上传附件",
    async ({
      mcpWorkflow,
      state,
      mcpOtherActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const upload = await db.upload.create({
          data: {
            userId: actor.userId,
            key: `mcp-comment-create/${crypto.randomUUID()}`,
            filename: "Owned MCP comment attachment.txt",
            contentType: "text/plain",
            size: 128,
          },
        });
        const before = await readCommentState(db);
        const body = "[integration-test] independent attached comment";
        const result = await actor.client.call<{
          success: boolean;
          id: string;
        }>("community_comment_create", {
          targetType: "section",
          sectionJwId: state.catalog.sections[0].jwId,
          body,
          attachmentIds: [upload.id],
        });
        expect(result.success).toBe(true);
        expect(result.id).toEqual(expect.any(String));
        const after = await readCommentState(db);
        expect(
          after.comments.find((row) => row.id === result.id),
        ).toMatchObject({
          userId: actor.userId,
          body,
          sectionId: state.catalog.sections[0].id,
          status: "active",
          attachments: [
            {
              id: expect.any(String),
              commentId: result.id,
              uploadId: upload.id,
              createdAt: expect.any(Date),
            },
          ],
        });
        expect(after.comments.filter((row) => row.id !== result.id)).toEqual(
          before.comments,
        );
        expect(after.uploads).toEqual(before.uploads);
        expect(after.audits).toHaveLength(before.audits.length + 1);
        expect(
          after.audits.find((row) => row.targetId === result.id),
        ).toMatchObject({
          action: "comment_create",
          userId: actor.userId,
          outcome: "success",
        });
      }),
  );

  mutationTest(
    "评论写入工具拒绝编辑时绑定其他用户的上传附件",
    async ({
      mcpWorkflow,
      state,
      mcpActor: actor,
      mcpOtherActor: other,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const own = await db.upload.create({
          data: {
            userId: actor.userId,
            key: `mcp-comment-own/${crypto.randomUUID()}`,
            filename: "Owned attached file.txt",
            contentType: "text/plain",
            size: 128,
            commentAttachments: { create: { commentId: state.rootId } },
          },
        });
        const foreign = await db.upload.create({
          data: {
            userId: other.userId,
            key: `mcp-comment-other/${crypto.randomUUID()}`,
            filename: "Other user's file.txt",
            contentType: "text/plain",
            size: 256,
          },
        });
        const before = await readCommentState(db);
        expect(
          before.comments.find((row) => row.id === state.rootId)?.attachments,
        ).toEqual([expect.objectContaining({ uploadId: own.id })]);
        const result = await actor.client.call("community_comment_update", {
          commentId: state.rootId,
          body: "[integration-test] rejected foreign attachment",
          attachmentIds: [foreign.id],
        });
        expect(result).toMatchObject({
          success: false,
          error: "invalid_attachments",
        });
        expect(await readCommentState(db)).toEqual(before);
      }),
  );

  mutationTest(
    "评论写入 community_comment_create 在目标查找前检查封禁状态",
    async ({
      mcpWorkflow,
      mcpOtherActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        await db.userSuspension.create({
          data: { userId: actor.userId, reason: "integration suspended" },
        });
        const before = await readCommentState(db);
        const result = await actor.client.call("community_comment_create", {
          targetType: "section",
          sectionJwId: 2_147_483_647,
          body: "[integration-test] suspended invalid target",
        });
        expect(result).toMatchObject({
          success: false,
          error: "suspended",
          reason: "integration suspended",
        });
        expect(await readCommentState(db)).toEqual(before);
      }),
  );

  for (const operation of ["delete", "reply", "reaction"] as const) {
    mutationTest(
      `评论写入工具拒绝已删除评论的 ${operation}`,
      async ({
        mcpWorkflow,
        state,
        mcpActor: actor,
        expect,
        isolatedDatabase: { owner: db },
      }) =>
        mcpWorkflow.run(async () => {
          await db.comment.update({
            where: { id: state.rootId },
            data: {
              status: "deleted",
              deletedAt: new Date("2026-01-02T00:00:00Z"),
            },
          });
          const before = await readCommentState(db);
          const result =
            operation === "reply"
              ? await actor.client.call("community_comment_create", {
                  targetType: "section",
                  sectionJwId: state.catalog.sections[0].jwId,
                  parentId: state.rootId,
                  body: "[integration-test] rejected reply",
                })
              : await actor.client.call(
                  operation === "delete"
                    ? "community_comment_delete"
                    : "community_comment_reaction_add",
                  {
                    commentId: state.rootId,
                    ...(operation === "reaction" ? { type: "heart" } : {}),
                  },
                );
          expect(result).toMatchObject({ success: false, error: "locked" });
          expect(await readCommentState(db)).toEqual(before);
        }),
    );
  }

  mutationTest(
    "评论写入工具拒绝软封禁评论的所有者删除",
    async ({
      mcpWorkflow,
      state,
      mcpActor: actor,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        await db.comment.update({
          where: { id: state.rootId },
          data: { status: "softbanned" },
        });
        const before = await readCommentState(db);
        expect(
          await actor.client.call("community_comment_delete", {
            commentId: state.rootId,
          }),
        ).toMatchObject({
          success: false,
          error: "locked",
          message: "Comment locked",
        });
        expect(await readCommentState(db)).toEqual(before);
      }),
  );
});
