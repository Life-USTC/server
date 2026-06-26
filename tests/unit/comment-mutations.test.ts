import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditLogCreateMock,
  buildCommentNodesMock,
  getViewerContextMock,
  isPrismaUniqueConstraintErrorMock,
  prismaMock,
  recordAuditWriteMetricMock,
  resolveCommentMutationTargetReferenceMock,
  resolveCommentTargetMock,
  transactionMock,
} = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(),
  buildCommentNodesMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  isPrismaUniqueConstraintErrorMock: vi.fn(),
  prismaMock: {
    $transaction: vi.fn(),
    comment: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    upload: {
      findMany: vi.fn(),
    },
  },
  recordAuditWriteMetricMock: vi.fn(),
  resolveCommentMutationTargetReferenceMock: vi.fn(),
  resolveCommentTargetMock: vi.fn(),
  transactionMock: {
    $queryRaw: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    commentAttachment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    commentReaction: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: isPrismaUniqueConstraintErrorMock,
}));

vi.mock("@/lib/metrics/observability-metrics", () => ({
  recordAuditWriteMetric: recordAuditWriteMetricMock,
}));

vi.mock("@/features/comments/server/comment-target-resolution", () => ({
  resolveCommentMutationTargetReference:
    resolveCommentMutationTargetReferenceMock,
}));

vi.mock("@/features/comments/server/comment-utils", () => ({
  resolveCommentTarget: resolveCommentTargetMock,
}));

vi.mock("@/features/comments/server/comment-serialization", () => ({
  buildCommentNodes: buildCommentNodesMock,
}));

const viewer = {
  userId: "user-1",
  name: "User",
  image: null,
  isAdmin: false,
  isAuthenticated: true,
  isSuspended: false,
  suspensionReason: null,
  suspensionExpiresAt: null,
};

function activeComment() {
  return {
    id: "comment-1",
    status: "active",
    userId: "user-1",
    visibility: "public",
  };
}

describe("comment mutation write guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getViewerContextMock.mockResolvedValue(viewer);
    isPrismaUniqueConstraintErrorMock.mockReturnValue(false);
    prismaMock.$transaction.mockImplementation((callback) =>
      callback(transactionMock),
    );
    transactionMock.auditLog.create = auditLogCreateMock;
    auditLogCreateMock.mockResolvedValue({});
  });

  it("locks the parent row inside the reply creation transaction", async () => {
    resolveCommentMutationTargetReferenceMock.mockResolvedValue({
      ok: true,
      rawTargetId: 1,
      sectionId: 1,
      targetType: "section",
    });
    resolveCommentTargetMock.mockResolvedValue({
      verified: true,
      whereTarget: { sectionId: 1 },
    });
    transactionMock.$queryRaw.mockResolvedValue([{ id: "parent-1" }]);
    transactionMock.comment.findUnique.mockResolvedValue({
      ...activeComment(),
      id: "parent-1",
      rootId: "root-1",
      sectionId: 1,
    });
    transactionMock.comment.create.mockResolvedValue({ id: "reply-1" });

    const { createComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await createComment({
      auditMetadata: {
        ipAddress: "127.0.0.1",
        source: "mcp",
        userAgent: "test-agent",
      },
      content: "reply",
      isAnonymous: false,
      parentId: "parent-1",
      rawTargetId: 1,
      targetType: "section",
      userId: "user-1",
      visibility: "public",
    });

    expect(result).toEqual({
      ok: true,
      comment: { id: "reply-1" },
    });
    expect(transactionMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transactionMock.comment.create.mock.invocationCallOrder[0],
    );
    expect(transactionMock.comment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "parent-1",
        rootId: "root-1",
        sectionId: 1,
      }),
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "comment_create",
        ipAddress: "127.0.0.1",
        metadata: { body: "reply", source: "mcp" },
        targetId: "reply-1",
        targetType: "comment",
        userAgent: "test-agent",
        userId: "user-1",
      }),
    });
    expect(
      transactionMock.comment.create.mock.invocationCallOrder[0],
    ).toBeLessThan(auditLogCreateMock.mock.invocationCallOrder[0]);
  });

  it("writes edit audit through the shared update mutation transaction", async () => {
    prismaMock.comment.findUnique
      .mockResolvedValueOnce(activeComment())
      .mockResolvedValueOnce({ id: "comment-1", body: "edited" });
    transactionMock.comment.updateMany.mockResolvedValue({ count: 1 });
    buildCommentNodesMock.mockReturnValue({
      roots: [{ id: "comment-1", body: "edited" }],
    });

    const { updateOwnComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await updateOwnComment({
      attachmentIds: [],
      auditMetadata: { source: "mcp" },
      body: "edited",
      hasAttachmentUpdate: false,
      id: "comment-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: true,
      comment: { id: "comment-1", body: "edited" },
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "comment_edit",
        metadata: { body: "edited", source: "mcp" },
        targetId: "comment-1",
        targetType: "comment",
        userId: "user-1",
      }),
    });
    expect(
      transactionMock.comment.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(auditLogCreateMock.mock.invocationCallOrder[0]);
  });

  it("does not sync edit attachments when the owner/status guard loses a race", async () => {
    prismaMock.comment.findUnique
      .mockResolvedValueOnce(activeComment())
      .mockResolvedValueOnce({ ...activeComment(), status: "deleted" });
    prismaMock.upload.findMany.mockResolvedValue([
      {
        id: "upload-1",
        commentAttachments: [{ commentId: "comment-1" }],
      },
    ]);
    transactionMock.comment.updateMany.mockResolvedValue({ count: 0 });

    const { updateOwnComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await updateOwnComment({
      attachmentIds: ["upload-1"],
      body: "edited",
      hasAttachmentUpdate: true,
      id: "comment-1",
      isAnonymous: false,
      userId: "user-1",
      visibility: "public",
    });

    expect(result).toEqual({ ok: false, error: "locked" });
    expect(transactionMock.comment.updateMany).toHaveBeenCalledWith({
      where: { id: "comment-1", status: "active", userId: "user-1" },
      data: {
        body: "edited",
        visibility: "public",
        isAnonymous: false,
      },
    });
    expect(transactionMock.commentAttachment.deleteMany).not.toHaveBeenCalled();
    expect(transactionMock.commentAttachment.createMany).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("guards delete by owner and active status in the final write", async () => {
    prismaMock.comment.findUnique
      .mockResolvedValueOnce(activeComment())
      .mockResolvedValueOnce({ ...activeComment(), status: "deleted" });
    transactionMock.comment.updateMany.mockResolvedValue({ count: 0 });

    const { deleteOwnComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await deleteOwnComment({
      commentId: "comment-1",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "locked" });
    expect(transactionMock.comment.updateMany).toHaveBeenCalledWith({
      where: { id: "comment-1", status: "active", userId: "user-1" },
      data: {
        status: "deleted",
        deletedAt: expect.any(Date),
      },
    });
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it("writes delete audit through the shared delete mutation transaction", async () => {
    prismaMock.comment.findUnique.mockResolvedValueOnce(activeComment());
    transactionMock.comment.updateMany.mockResolvedValue({ count: 1 });

    const { deleteOwnComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await deleteOwnComment({
      auditMetadata: { source: "mcp" },
      commentId: "comment-1",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: true });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "comment_delete",
        metadata: { source: "mcp" },
        targetId: "comment-1",
        targetType: "comment",
        userId: "user-1",
      }),
    });
    expect(
      transactionMock.comment.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(auditLogCreateMock.mock.invocationCallOrder[0]);
  });

  it("writes reaction audit through the shared reaction mutation transaction", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(activeComment());
    transactionMock.commentReaction.createMany.mockResolvedValue({ count: 1 });

    const { createCommentReaction } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await createCommentReaction({
      auditMetadata: { source: "mcp" },
      commentId: "comment-1",
      type: "heart",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: true, changed: true });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "comment_react",
        metadata: { operation: "add", source: "mcp", type: "heart" },
        targetId: "comment-1",
        targetType: "comment",
        userId: "user-1",
      }),
    });
    expect(
      transactionMock.commentReaction.createMany.mock.invocationCallOrder[0],
    ).toBeLessThan(auditLogCreateMock.mock.invocationCallOrder[0]);
  });

  it("writes reaction removal audit through the shared reaction mutation transaction", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(activeComment());
    transactionMock.commentReaction.deleteMany.mockResolvedValue({ count: 1 });

    const { deleteCommentReaction } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await deleteCommentReaction({
      auditMetadata: { source: "mcp" },
      commentId: "comment-1",
      type: "heart",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: true, changed: true });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "comment_react",
        metadata: { operation: "remove", source: "mcp", type: "heart" },
        targetId: "comment-1",
        targetType: "comment",
        userId: "user-1",
      }),
    });
    expect(
      transactionMock.commentReaction.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(auditLogCreateMock.mock.invocationCallOrder[0]);
  });
});
