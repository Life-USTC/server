import { describe, expect, it } from "vitest";
import { createMcpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("comment read tools — MCP exposes the REST comment hierarchy", () => {
  it("list_comments returns threaded section comments with viewer/action fields", async () => {
    const result = await context.client.call<{
      found?: boolean;
      comments?: Array<{
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
    }>("list_comments", {
      targetType: "section",
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.target?.type).toBe("section");
    expect(typeof result.target?.targetId).toBe("number");
    expect(result.target?.sectionJwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect(result.target?.sectionCode).toBe(fixtures.DEV_SEED.section.code);
    expect(result.target?.courseJwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(result.target?.courseName).toBe(fixtures.DEV_SEED.course.nameCn);
    expect(result.viewer?.userId).toBe(context.devUserId);
    expect(result.viewer?.isAuthenticated).toBe(true);
    expect(typeof result.hiddenCount).toBe("number");

    const root = result.comments?.find((comment) =>
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

  it("get_comment_thread returns the focused thread and target metadata", async () => {
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

  it("list_comments reports missing targets instead of returning an empty success", async () => {
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

  it("list_comments reports unattached section-teacher pairs as missing targets", async () => {
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

  it("list_comments does not create section-teacher targets while reading", async () => {
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
        found?: boolean;
        comments?: unknown[];
        target?: {
          sectionId?: number | null;
          sectionTeacherId?: number | null;
          teacherId?: number | null;
        };
      }>("list_comments", {
        targetType: "section-teacher",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        teacherId,
      });

      expect(result.found).toBe(true);
      expect(result.comments).toEqual([]);
      expect(result.target?.sectionId).toBe(section.id);
      expect(result.target?.teacherId).toBe(teacherId);
      expect(result.target?.sectionTeacherId).toBeNull();

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

describe("comment write tools — MCP mirrors ordinary-user REST writes", () => {
  it("comment write create/update/delete and reaction calls serialize success and audit source", async () => {
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

  it("comment write tools reject unsupported anonymous visibility", async () => {
    await expect(
      context.client.call("create_comment", {
        targetType: "section",
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        body: `[integration-test] rejected anonymous visibility ${Date.now()}`,
        visibility: "anonymous",
      }),
    ).rejects.toThrow();
  });

  it("comment write create_comment returns a serialized invalid-target failure", async () => {
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

  it("comment write create_comment supports replies through the public MCP surface", async () => {
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

  it("comment write tools deny non-owner edit and delete attempts", async () => {
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

  it("comment write tools validate existing upload attachments", async () => {
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

  it("upload metadata tools list, rename, and preserve retry state on delete storage failure", async () => {
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
        uploads?: Array<{ filename?: string; id?: string; size?: number }>;
        maxFileSizeBytes?: number;
        quotaBytes?: number;
        usedBytes?: number;
      }>("list_my_uploads", { mode: "full" });
      expect(typeof listBefore.maxFileSizeBytes).toBe("number");
      expect(typeof listBefore.quotaBytes).toBe("number");
      expect(typeof listBefore.usedBytes).toBe("number");
      expect(
        listBefore.uploads?.some(
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

  it("upload rename rejects control-character filenames without sanitizing", async () => {
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

  it("upload metadata tools deny non-owner and suspended writes", async () => {
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

  it("comment write create_comment checks suspension before target lookup", async () => {
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

  it("comment write tools reject replies and reactions on deleted comments", async () => {
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

  it("comment write tools reject owner delete on softbanned comments", async () => {
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
