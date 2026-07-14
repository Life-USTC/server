import { describe, expect, it } from "vitest";
import { createMcpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("评论读取工具 — MCP 暴露 REST 评论层级", () => {
  it("list_comments 返回带查看者/操作字段的班级串帖评论", async () => {
    const result = await context.client.call<{
      found?: boolean;
      data?: Array<{
        id?: string;
        body?: string;
        author?: { name?: string | null } | null;
        replies?: Array<{ body?: string }>;
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
    }>("list_comments", {
      targetType: "section",
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.meta?.target?.type).toBe("section");
    expect(typeof result.meta?.target?.targetId).toBe("number");
    expect(result.meta?.target?.sectionJwId).toBe(
      fixtures.DEV_SEED.section.jwId,
    );
    expect(result.meta?.target?.sectionCode).toBe(
      fixtures.DEV_SEED.section.code,
    );
    expect(result.meta?.target?.courseJwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(result.meta?.target?.courseName).toBe(
      fixtures.DEV_SEED.course.nameCn,
    );
    expect(result.meta?.viewer?.userId).toBe(context.devUserId);
    expect(result.meta?.viewer?.isAuthenticated).toBe(true);
    expect(typeof result.meta?.hiddenCount).toBe("number");
    expect(result.pagination).toMatchObject({ page: 1, pageSize: 20 });

    const root = result.data?.find((comment) =>
      comment.body?.includes(fixtures.DEV_SEED.comments.sectionRootBody),
    );
    expect(root).toBeDefined();
    expect(root?.author?.name).toBe(fixtures.DEV_SEED.debugName);
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
  });

  it("get_comment_thread 返回聚焦线程及目标元数据", async () => {
    const seedComment = await fixtures.prisma.comment.findFirst({
      where: { body: fixtures.DEV_SEED.comments.sectionRootBody },
      select: { id: true },
    });
    expect(seedComment?.id).toBeTruthy();

    const result = await context.client.call<{
      found?: boolean;
      focusId?: string;
      thread?: Array<{
        id?: string;
        body?: string;
        replies?: Array<{ body?: string }>;
      }>;
      target?: {
        courseJwId?: number | null;
        courseName?: string | null;
        sectionJwId?: number | null;
        sectionCode?: string | null;
      };
    }>("get_comment_thread", {
      commentId: seedComment?.id,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.focusId).toBe(seedComment?.id);
    expect(result.thread?.[0]?.id).toBe(seedComment?.id);
    expect(result.thread?.[0]?.body).toContain(
      fixtures.DEV_SEED.comments.sectionRootBody,
    );
    expect(result.thread?.[0]?.replies?.length).toBeGreaterThan(0);
    expect(result.target?.sectionJwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect(result.target?.sectionCode).toBe(fixtures.DEV_SEED.section.code);
    expect(result.target?.courseJwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(result.target?.courseName).toBe(fixtures.DEV_SEED.course.nameCn);
  });

  it("list_comments 报告缺失目标而非返回空成功", async () => {
    const result = await context.client.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
    }>("list_comments", {
      targetType: "section",
      sectionJwId: 2_147_483_647,
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("target_not_found");
  });

  it("list_comments 将未关联的班级-教师对报告为缺失目标", async () => {
    const marker = `[integration-test] mcp-section-teacher-missing-${Date.now()}`;
    const teacher = await fixtures.prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        success?: boolean;
        found?: boolean;
        error?: string;
      }>("list_comments", {
        targetType: "section-teacher",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        teacherId: teacher.id,
      });

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toBe("target_not_found");
    } finally {
      await fixtures.prisma.teacher.deleteMany({ where: { id: teacher.id } });
    }
  });

  it("list_comments 读取时不创建班级-教师目标", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const marker = `[integration-test] mcp-section-teacher-read-${Date.now()}`;
    let teacherId: number | null = null;

    try {
      const teacher = await fixtures.prisma.teacher.create({
        data: {
          code: marker,
          nameCn: marker,
        },
        select: { id: true },
      });
      teacherId = teacher.id;

      await fixtures.prisma.section.update({
        where: { id: section.id },
        data: { teachers: { connect: { id: teacherId } } },
      });

      const before = await fixtures.prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId: section.id,
            teacherId,
          },
        },
        select: { id: true },
      });
      expect(before).toBeNull();

      const result = await context.client.call<{
        data?: unknown[];
        found?: boolean;
        meta?: {
          target?: {
            sectionId?: number | null;
            sectionTeacherId?: number | null;
            teacherId?: number | null;
          };
        };
      }>("list_comments", {
        targetType: "section-teacher",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        teacherId,
      });

      expect(result.found).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.meta?.target?.sectionId).toBe(section.id);
      expect(result.meta?.target?.teacherId).toBe(teacherId);
      expect(result.meta?.target?.sectionTeacherId).toBeNull();

      const after = await fixtures.prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId: section.id,
            teacherId,
          },
        },
        select: { id: true },
      });
      expect(after).toBeNull();
    } finally {
      if (teacherId) {
        await fixtures.prisma.sectionTeacher.deleteMany({
          where: { sectionId: section.id, teacherId },
        });
        await fixtures.prisma.section.update({
          where: { id: section.id },
          data: { teachers: { disconnect: { id: teacherId } } },
        });
        await fixtures.prisma.teacher.deleteMany({ where: { id: teacherId } });
      }
    }
  });
});

describe("评论写入工具 — MCP 镜像普通用户 REST 写入", () => {
  it("评论写入的创建/更新/删除及反应调用序列化成功与审计来源", async () => {
    const marker = `[integration-test] mcp-comment-write-${Date.now()}`;
    let commentId: string | undefined;

    try {
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} created`,
        visibility: "public",
        isAnonymous: false,
      });

      expect(created.success).toBe(true);
      expect(typeof created.id).toBe("string");
      commentId = created.id;
      if (!commentId) {
        throw new Error("create_comment returned no comment id");
      }

      const createAudit = await fixtures.findCommentAuditLog({
        action: "comment_create",
        commentId,
        metadata: { source: "mcp" },
      });
      expect(createAudit?.metadata).toMatchObject({
        body: `${marker} created`,
        source: "mcp",
      });

      const updated = await context.client.call<{
        success?: boolean;
        comment?: {
          id?: string;
          body?: string;
          isAnonymous?: boolean;
          visibility?: string;
          canEdit?: boolean;
        };
      }>("update_own_comment", {
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

      const editAudit = await fixtures.findCommentAuditLog({
        action: "comment_edit",
        commentId,
        metadata: { source: "mcp" },
      });
      expect(editAudit?.metadata).toMatchObject({
        body: `${marker} updated`,
        source: "mcp",
      });

      const addedReaction = await context.client.call<{
        success?: boolean;
        changed?: boolean;
      }>("add_comment_reaction", {
        commentId,
        type: "heart",
      });

      expect(addedReaction).toEqual({ success: true, changed: true });

      const addReactionAudit = await fixtures.findCommentAuditLog({
        action: "comment_react",
        commentId,
        metadata: { operation: "add", source: "mcp", type: "heart" },
      });
      expect(addReactionAudit?.metadata).toMatchObject({
        operation: "add",
        source: "mcp",
        type: "heart",
      });

      const removedReaction = await context.client.call<{
        success?: boolean;
        changed?: boolean;
      }>("remove_comment_reaction", {
        commentId,
        type: "heart",
      });

      expect(removedReaction).toEqual({ success: true, changed: true });

      const removeReactionAudit = await fixtures.findCommentAuditLog({
        action: "comment_react",
        commentId,
        metadata: { operation: "remove", source: "mcp", type: "heart" },
      });
      expect(removeReactionAudit?.metadata).toMatchObject({
        operation: "remove",
        source: "mcp",
        type: "heart",
      });

      const deleted = await context.client.call<{ success?: boolean }>(
        "delete_own_comment",
        { commentId },
      );

      expect(deleted).toEqual({ success: true });

      const deleteAudit = await fixtures.findCommentAuditLog({
        action: "comment_delete",
        commentId,
        metadata: { source: "mcp" },
      });
      expect(deleteAudit?.metadata).toMatchObject({ source: "mcp" });
    } finally {
      if (commentId) {
        await fixtures.sleep(50);
        await fixtures.deleteCommentRecords([commentId]);
      }
    }
  });

  it("评论写入工具拒绝不支持的匿名可见性", async () => {
    await expect(
      context.client.call("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `[integration-test] rejected anonymous visibility ${Date.now()}`,
        visibility: "anonymous",
      }),
    ).rejects.toThrow();
  });

  it("评论写入 create_comment 返回序列化的无效目标失败", async () => {
    const result = await context.client.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
      message?: string;
    }>("create_comment", {
      targetType: "section",
      sectionJwId: 2_147_483_647,
      body: "[integration-test] invalid mcp comment target",
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("target_not_found");
    expect(result.message).toContain("section");
  });

  it("评论写入 create_comment 支持通过公共 MCP 接口回复", async () => {
    const marker = `[integration-test] mcp-comment-reply-${Date.now()}`;
    const commentIds: string[] = [];

    try {
      const parent = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} parent`,
      });
      expect(parent.success).toBe(true);
      expect(typeof parent.id).toBe("string");
      commentIds.push(parent.id ?? "");

      const reply = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        parentId: parent.id,
        body: `${marker} reply`,
      });
      expect(reply.success).toBe(true);
      expect(typeof reply.id).toBe("string");
      commentIds.push(reply.id ?? "");

      const thread = await context.client.call<{
        found?: boolean;
        focusId?: string;
        thread?: unknown;
      }>("get_comment_thread", {
        commentId: reply.id,
        mode: "full",
      });
      expect(thread.found).toBe(true);
      expect(thread.focusId).toBe(reply.id);
      expect(JSON.stringify(thread.thread)).toContain(reply.id ?? "");
    } finally {
      await fixtures.deleteCommentRecords(commentIds.filter(Boolean));
    }
  });

  it("评论写入工具拒绝非所有者编辑和删除尝试", async () => {
    const marker = `[integration-test] mcp-comment-non-owner-${Date.now()}`;
    const otherUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-comment-non-owner"),
        name: "MCP Comment Non Owner",
      },
      select: { id: true },
    });
    const otherMcp = await createMcpHarness(otherUser.id);
    let commentId: string | undefined;

    try {
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} owned`,
      });
      expect(created.success).toBe(true);
      commentId = created.id;
      expect(typeof commentId).toBe("string");

      const update = await otherMcp.call<{
        success?: boolean;
        error?: string;
      }>("update_own_comment", {
        commentId,
        body: `${marker} stolen edit`,
      });
      expect(update).toMatchObject({
        success: false,
        error: "forbidden",
      });

      const deletion = await otherMcp.call<{
        success?: boolean;
        error?: string;
      }>("delete_own_comment", { commentId });
      expect(deletion).toMatchObject({
        success: false,
        error: "forbidden",
      });
    } finally {
      await otherMcp.close();
      await fixtures.deleteCommentRecords(commentId ? [commentId] : []);
      await fixtures.prisma.user.deleteMany({ where: { id: otherUser.id } });
    }
  });

  it("评论写入工具校验现有上传附件", async () => {
    const marker = `[integration-test] mcp-comment-attachments-${Date.now()}`;
    const filename = `mcp-comment-attachment-${Date.now()}.txt`;
    const upload = await fixtures.prisma.upload.create({
      data: {
        userId: context.devUserId,
        key: `integration-test/${filename}`,
        filename,
        contentType: "text/plain",
        size: 128,
      },
      select: { id: true, filename: true },
    });
    const otherUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-comment-attachment-owner"),
        name: "MCP Comment Attachment Owner",
      },
      select: { id: true },
    });
    const otherUpload = await fixtures.prisma.upload.create({
      data: {
        userId: otherUser.id,
        key: `integration-test/other-${filename}`,
        filename: `other-${filename}`,
        contentType: "text/plain",
        size: 256,
      },
      select: { id: true },
    });
    let commentId: string | undefined;

    try {
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} attached`,
        attachmentIds: [upload.id],
      });
      expect(created.success).toBe(true);
      commentId = created.id;
      expect(typeof commentId).toBe("string");

      const thread = await context.client.call<{
        found?: boolean;
        thread?: unknown;
      }>("get_comment_thread", {
        commentId,
        mode: "full",
      });
      expect(thread.found).toBe(true);
      expect(JSON.stringify(thread.thread)).toContain(upload.filename);

      const invalidUpdate = await context.client.call<{
        success?: boolean;
        error?: string;
      }>("update_own_comment", {
        commentId,
        body: `${marker} invalid attachment`,
        attachmentIds: [otherUpload.id],
      });
      expect(invalidUpdate).toMatchObject({
        success: false,
        error: "invalid_attachments",
      });
    } finally {
      await fixtures.deleteCommentRecords(commentId ? [commentId] : []);
      await fixtures.prisma.upload.deleteMany({
        where: { id: { in: [upload.id, otherUpload.id] } },
      });
      await fixtures.prisma.user.deleteMany({ where: { id: otherUser.id } });
    }
  });

  it("上传元数据工具列出、重命名并在存储删除失败时保留重试状态", async () => {
    const filename = `mcp-upload-${Date.now()}.txt`;
    const upload = await fixtures.prisma.upload.create({
      data: {
        userId: context.devUserId,
        key: `integration-test/${filename}`,
        filename,
        contentType: "text/plain",
        size: 321,
      },
      select: { id: true, key: true, size: true },
    });
    const renamedFilename = `renamed-${filename}`;

    try {
      const listBefore = await context.client.call<{
        data?: Array<{ filename?: string; id?: string; size?: number }>;
        meta?: {
          maxFileSizeBytes?: number;
          quotaBytes?: number;
          usedBytes?: number;
        };
        pagination?: { page?: number; pageSize?: number; total?: number };
      }>("list_my_uploads", { mode: "full" });
      expect(typeof listBefore.meta?.maxFileSizeBytes).toBe("number");
      expect(typeof listBefore.meta?.quotaBytes).toBe("number");
      expect(typeof listBefore.meta?.usedBytes).toBe("number");
      expect(listBefore.pagination).toMatchObject({ page: 1, pageSize: 20 });
      expect(
        listBefore.data?.some(
          (item) =>
            item.id === upload.id &&
            item.filename === filename &&
            item.size === upload.size,
        ),
      ).toBe(true);

      const renamed = await context.client.call<{
        success?: boolean;
        upload?: { filename?: string; id?: string };
      }>("rename_my_upload", {
        id: upload.id,
        filename: renamedFilename,
      });
      expect(renamed).toMatchObject({
        success: true,
        upload: { id: upload.id, filename: renamedFilename },
      });

      const deleted = await context.client.call<{
        error?: string;
        hint?: string;
        message?: string;
        success?: boolean;
      }>("delete_my_upload", { id: upload.id });
      expect(deleted).toMatchObject({
        success: false,
        error: "storage_delete_failed",
        message: "Failed to delete upload object",
      });

      const retainedUpload = await fixtures.prisma.upload.findUnique({
        where: { id: upload.id },
        select: { filename: true },
      });
      expect(retainedUpload?.filename).toBe(renamedFilename);
    } finally {
      await fixtures.prisma.auditLog.deleteMany({
        where: { targetId: upload.id, targetType: "upload" },
      });
      await fixtures.prisma.upload.deleteMany({ where: { id: upload.id } });
    }
  });

  it("上传重命名拒绝控制字符文件名且不做清洗", async () => {
    const filename = `mcp-upload-invalid-rename-${Date.now()}.txt`;
    const upload = await fixtures.prisma.upload.create({
      data: {
        userId: context.devUserId,
        key: `integration-test/${filename}`,
        filename,
        contentType: "text/plain",
        size: 321,
      },
      select: { id: true },
    });

    try {
      for (const invalidFilename of ["bad\u0000name.txt", "\u0000"]) {
        await expect(
          context.client.call("rename_my_upload", {
            id: upload.id,
            filename: invalidFilename,
          }),
        ).rejects.toThrow();
      }

      const unchanged = await fixtures.prisma.upload.findUnique({
        where: { id: upload.id },
        select: { filename: true },
      });
      expect(unchanged?.filename).toBe(filename);
    } finally {
      await fixtures.prisma.upload.deleteMany({ where: { id: upload.id } });
    }
  });

  it("上传元数据工具拒绝非所有者及被禁用户写入", async () => {
    const otherUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-upload-owner"),
        name: "MCP Upload Owner",
      },
      select: { id: true },
    });
    const otherUpload = await fixtures.prisma.upload.create({
      data: {
        userId: otherUser.id,
        key: `integration-test/mcp-upload-other-${Date.now()}.txt`,
        filename: "other-upload.txt",
        contentType: "text/plain",
        size: 123,
      },
      select: { id: true },
    });
    const suspendedUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-upload-suspended"),
        name: "MCP Upload Suspended",
      },
      select: { id: true },
    });
    const suspendedUpload = await fixtures.prisma.upload.create({
      data: {
        userId: suspendedUser.id,
        key: `integration-test/mcp-upload-suspended-${Date.now()}.txt`,
        filename: "suspended-upload.txt",
        contentType: "text/plain",
        size: 124,
      },
      select: { id: true },
    });
    const suspension = await fixtures.prisma.userSuspension.create({
      data: {
        userId: suspendedUser.id,
        createdById: context.devUserId,
        reason: "integration suspended",
      },
      select: { id: true },
    });
    const suspendedMcp = await createMcpHarness(suspendedUser.id);

    try {
      const nonOwnerRename = await context.client.call<{
        error?: string;
        success?: boolean;
      }>("rename_my_upload", {
        id: otherUpload.id,
        filename: "stolen.txt",
      });
      expect(nonOwnerRename).toMatchObject({
        success: false,
        error: "not_found",
      });

      const nonOwnerDelete = await context.client.call<{
        error?: string;
        success?: boolean;
      }>("delete_my_upload", { id: otherUpload.id });
      expect(nonOwnerDelete).toMatchObject({
        success: false,
        error: "not_found",
      });

      const suspendedDelete = await suspendedMcp.call<{
        error?: string;
        reason?: string | null;
        success?: boolean;
      }>("delete_my_upload", { id: suspendedUpload.id });
      expect(suspendedDelete).toMatchObject({
        success: false,
        error: "suspended",
        reason: "integration suspended",
      });
    } finally {
      await suspendedMcp.close();
      await fixtures.prisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await fixtures.prisma.upload.deleteMany({
        where: { id: { in: [otherUpload.id, suspendedUpload.id] } },
      });
      await fixtures.prisma.user.deleteMany({
        where: { id: { in: [otherUser.id, suspendedUser.id] } },
      });
    }
  });

  it("评论写入 create_comment 在目标查找前检查封禁状态", async () => {
    const suspendedUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-comment-suspended"),
        name: "MCP Comment Suspended",
      },
      select: { id: true },
    });
    const suspension = await fixtures.prisma.userSuspension.create({
      data: {
        userId: suspendedUser.id,
        createdById: context.devUserId,
        reason: "integration suspended",
      },
      select: { id: true },
    });
    const suspendedMcp = await createMcpHarness(suspendedUser.id);

    try {
      const result = await suspendedMcp.call<{
        success?: boolean;
        error?: string;
        reason?: string | null;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: 2_147_483_647,
        body: "[integration-test] suspended invalid target",
      });

      expect(result).toMatchObject({
        success: false,
        error: "suspended",
        reason: "integration suspended",
      });
    } finally {
      await suspendedMcp.close();
      await fixtures.prisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await fixtures.prisma.user.deleteMany({
        where: { id: suspendedUser.id },
      });
    }
  });

  it("评论写入工具拒绝已删除评论的回复和反应", async () => {
    const marker = `[integration-test] mcp-comment-locked-${Date.now()}`;
    let commentId: string | undefined;

    try {
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} deleted`,
      });
      expect(created.success).toBe(true);
      commentId = created.id;
      expect(typeof commentId).toBe("string");

      await expect(
        context.client.call<{ success?: boolean }>("delete_own_comment", {
          commentId,
        }),
      ).resolves.toEqual({ success: true });

      const repeatedDelete = await context.client.call<{
        success?: boolean;
        error?: string;
      }>("delete_own_comment", { commentId });
      expect(repeatedDelete).toMatchObject({
        success: false,
        error: "locked",
      });

      const reply = await context.client.call<{
        success?: boolean;
        error?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        parentId: commentId,
        body: `${marker} rejected reply`,
      });
      expect(reply).toMatchObject({ success: false, error: "locked" });

      const reaction = await context.client.call<{
        success?: boolean;
        error?: string;
      }>("add_comment_reaction", {
        commentId,
        type: "heart",
      });
      expect(reaction).toMatchObject({ success: false, error: "locked" });
    } finally {
      await fixtures.deleteCommentRecords(commentId ? [commentId] : []);
    }
  });

  it("评论写入工具拒绝软封禁评论的所有者删除", async () => {
    const marker = `[integration-test] mcp-comment-softbanned-delete-${Date.now()}`;
    let commentId: string | undefined;

    try {
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
      }>("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `${marker} locked`,
      });
      expect(created.success).toBe(true);
      commentId = created.id;
      expect(typeof commentId).toBe("string");

      await fixtures.prisma.comment.update({
        where: { id: commentId },
        data: { status: "softbanned" },
      });

      const deletion = await context.client.call<{
        success?: boolean;
        error?: string;
        message?: string;
      }>("delete_own_comment", { commentId });

      expect(deletion).toMatchObject({
        success: false,
        error: "locked",
        message: "Comment locked",
      });
    } finally {
      await fixtures.deleteCommentRecords(commentId ? [commentId] : []);
    }
  });
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------
