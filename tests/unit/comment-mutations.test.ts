import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getViewerContextMock,
  isPrismaUniqueConstraintErrorMock,
  prismaMock,
  resolveCommentMutationTargetReferenceMock,
  resolveCommentTargetMock,
  transactionMock,
} = vi.hoisted(() => ({
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
  resolveCommentMutationTargetReferenceMock: vi.fn(),
  resolveCommentTargetMock: vi.fn(),
  transactionMock: {
    $queryRaw: vi.fn(),
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

vi.mock("@/features/comments/server/comment-target-resolution", () => ({
  resolveCommentMutationTargetReference:
    resolveCommentMutationTargetReferenceMock,
}));

vi.mock("@/features/comments/server/comment-utils", () => ({
  resolveCommentTarget: resolveCommentTargetMock,
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
  });

  it("guards delete by owner and active status in the final write", async () => {
    prismaMock.comment.findUnique
      .mockResolvedValueOnce(activeComment())
      .mockResolvedValueOnce({ ...activeComment(), status: "deleted" });
    prismaMock.comment.updateMany.mockResolvedValue({ count: 0 });

    const { deleteOwnComment } = await import(
      "@/features/comments/server/comment-mutations"
    );
    const result = await deleteOwnComment({
      commentId: "comment-1",
      userId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "locked" });
    expect(prismaMock.comment.updateMany).toHaveBeenCalledWith({
      where: { id: "comment-1", status: "active", userId: "user-1" },
      data: {
        status: "deleted",
        deletedAt: expect.any(Date),
      },
    });
  });
});
