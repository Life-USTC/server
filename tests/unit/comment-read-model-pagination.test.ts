import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  accountFindManyMock,
  attachmentSummaryQueryMock,
  commentCountMock,
  commentFindManyMock,
  contextQueryMock,
  publicAttachmentSummaryQueryMock,
  publicQueryMock,
  publicReactionSummaryQueryMock,
  reactionSummaryQueryMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  accountFindManyMock: vi.fn(),
  attachmentSummaryQueryMock: vi.fn(),
  commentCountMock: vi.fn(),
  commentFindManyMock: vi.fn(),
  contextQueryMock: vi.fn(),
  publicAttachmentSummaryQueryMock: vi.fn(),
  publicQueryMock: vi.fn(),
  publicReactionSummaryQueryMock: vi.fn(),
  reactionSummaryQueryMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    account: {
      findMany: accountFindManyMock,
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: publicQueryMock,
    comment: {
      count: commentCountMock,
      findMany: commentFindManyMock,
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

import { loadCommentThread } from "@/features/comments/server/comment-read-model";

const now = new Date("2026-01-01T00:00:00.000Z");
const viewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: true,
  isSuspended: false,
  name: "Viewer",
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: "viewer-1",
};

function comment(
  id: string,
  overrides: {
    parentId?: string | null;
    rootId?: string | null;
    user?: {
      id: string;
      image: string | null;
      isAdmin: boolean;
      name: string;
    } | null;
  } = {},
) {
  return {
    attachments: [],
    body: id,
    createdAt: now,
    id,
    parentId: overrides.parentId ?? null,
    reactions: [],
    rootId: overrides.rootId ?? null,
    status: "active" as const,
    updatedAt: now,
    user: overrides.user ?? null,
    userId: overrides.user?.id ?? null,
    visibility: "public" as const,
  };
}

function target(whereTarget: Record<string, number | string>) {
  return {
    empty: false,
    homeworkId: null,
    sectionId: null,
    sectionTeacherId: null,
    targetId: null,
    teacherId: null,
    verified: true,
    whereTarget,
  } satisfies Parameters<typeof loadCommentThread>[0]["target"];
}

describe("loadCommentThread pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountFindManyMock.mockResolvedValue([]);
    commentCountMock.mockResolvedValue(3);
    publicReactionSummaryQueryMock.mockResolvedValue([]);
    publicAttachmentSummaryQueryMock.mockResolvedValue([]);
    reactionSummaryQueryMock.mockResolvedValue([]);
    attachmentSummaryQueryMock.mockResolvedValue([]);
    contextQueryMock.mockImplementation((query) =>
      query.strings.join(" ").includes("comment_attachment_summaries")
        ? attachmentSummaryQueryMock(query)
        : reactionSummaryQueryMock(query),
    );
    publicQueryMock.mockImplementation((query) =>
      query.strings.join(" ").includes("comment_attachment_summaries")
        ? publicAttachmentSummaryQueryMock(query)
        : publicReactionSummaryQueryMock(query),
    );
    withUserDbContextMock.mockImplementation((_userId, callback) =>
      callback({ $queryRaw: contextQueryMock }),
    );
  });

  it("paginates roots, then loads the selected root's complete reply tree", async () => {
    commentFindManyMock
      .mockResolvedValueOnce([{ id: "root-2" }])
      .mockResolvedValueOnce([
        comment("root-2"),
        comment("reply-2", { parentId: "root-2", rootId: "root-2" }),
      ]);

    const result = await loadCommentThread({
      pagination: { pageSize: 1, skip: 1 },
      target: target({ sectionId: 7 }),
      viewer,
      viewerUserId: viewer.userId,
    });

    expect(result.total).toBe(3);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]).toMatchObject({
      id: "root-2",
      replies: [expect.objectContaining({ id: "reply-2" })],
    });
    expect(commentCountMock).toHaveBeenCalledWith({
      where: {
        AND: [
          { sectionId: 7 },
          { parentId: null },
          {
            OR: [
              {
                AND: [
                  {
                    OR: [
                      { status: "active" },
                      { status: "softbanned", userId: "viewer-1" },
                    ],
                  },
                ],
              },
              {
                thread: {
                  some: {
                    AND: [
                      {
                        OR: [
                          { status: "active" },
                          { status: "softbanned", userId: "viewer-1" },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    });
    expect(commentFindManyMock).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { sectionId: 7 },
          { parentId: null },
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      skip: 1,
      take: 1,
    });
    expect(commentFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AND: [
            { sectionId: 7 },
            {
              OR: [{ id: { in: ["root-2"] } }, { rootId: { in: ["root-2"] } }],
            },
          ],
        },
      }),
    );
  });

  it("loads OIDC provider badges once for all comment authors", async () => {
    const ustcUser = {
      id: "user-ustc",
      image: null,
      isAdmin: false,
      name: "USTC User",
    };
    const otherUser = {
      id: "user-other",
      image: null,
      isAdmin: false,
      name: "Other User",
    };
    commentFindManyMock
      .mockResolvedValueOnce([{ id: "root-2" }])
      .mockResolvedValueOnce([
        comment("root-2", { user: ustcUser }),
        comment("reply-2", {
          parentId: "root-2",
          rootId: "root-2",
          user: otherUser,
        }),
      ]);
    accountFindManyMock.mockResolvedValue([
      { provider: "oidc", userId: "user-ustc" },
    ]);

    const result = await loadCommentThread({
      pagination: { pageSize: 1, skip: 1 },
      target: target({ sectionId: 7 }),
      viewer,
      viewerUserId: viewer.userId,
    });

    expect(accountFindManyMock).toHaveBeenCalledOnce();
    expect(accountFindManyMock).toHaveBeenCalledWith({
      where: {
        provider: "oidc",
        userId: { in: ["user-ustc", "user-other"] },
      },
      select: {
        provider: true,
        userId: true,
      },
    });
    expect(result.comments[0]?.author?.isUstcVerified).toBe(true);
    expect(result.comments[0]?.replies[0]?.author?.isUstcVerified).toBe(false);
    expect(commentFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        include: expect.objectContaining({
          user: {
            select: {
              id: true,
              image: true,
              isAdmin: true,
              name: true,
            },
          },
        }),
      }),
    );
    expect(commentFindManyMock.mock.calls[1]?.[0].include).not.toHaveProperty(
      "reactions",
    );
  });

  it("loads aggregate reactions inside the authenticated viewer context", async () => {
    commentFindManyMock
      .mockResolvedValueOnce([{ id: "root-2" }])
      .mockResolvedValueOnce([comment("root-2")]);
    reactionSummaryQueryMock.mockResolvedValue([
      {
        commentId: "root-2",
        count: 3n,
        type: "heart",
        viewerHasReacted: true,
      },
    ]);

    const result = await loadCommentThread({
      pagination: { pageSize: 1, skip: 1 },
      target: target({ sectionId: 7 }),
      viewer,
      viewerUserId: viewer.userId,
    });

    expect(result.comments[0]?.reactions).toEqual([
      { count: 3, type: "heart", viewerHasReacted: true },
    ]);
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      viewer.userId,
      expect.any(Function),
    );
    expect(reactionSummaryQueryMock).toHaveBeenCalledOnce();
    expect(attachmentSummaryQueryMock).toHaveBeenCalledOnce();
    expect(publicReactionSummaryQueryMock).not.toHaveBeenCalled();
    const [query] = reactionSummaryQueryMock.mock.calls[0] ?? [];
    expect(query.strings.join(" ")).toContain(
      "public.comment_reaction_summaries",
    );
  });

  it("loads visible attachment metadata through the narrow database function", async () => {
    commentFindManyMock
      .mockResolvedValueOnce([{ id: "root-2" }])
      .mockResolvedValueOnce([comment("root-2")]);
    attachmentSummaryQueryMock.mockResolvedValue([
      {
        commentId: "root-2",
        contentType: "text/plain",
        filename: "note.txt",
        id: "attachment-1",
        size: 12,
        uploadId: "upload-1",
      },
    ]);

    const result = await loadCommentThread({
      pagination: { pageSize: 1, skip: 1 },
      target: target({ sectionId: 7 }),
      viewer,
      viewerUserId: viewer.userId,
    });

    expect(result.comments[0]?.attachments).toEqual([
      {
        contentType: "text/plain",
        filename: "note.txt",
        id: "attachment-1",
        size: 12,
        uploadId: "upload-1",
        url: "/api/workspace/uploads/upload-1/download",
      },
    ]);
    expect(attachmentSummaryQueryMock).toHaveBeenCalledOnce();
    const [query] = attachmentSummaryQueryMock.mock.calls[0] ?? [];
    expect(query.strings.join(" ")).toContain(
      "public.comment_attachment_summaries",
    );
    expect(commentFindManyMock.mock.calls[1]?.[0].include).not.toHaveProperty(
      "attachments",
    );
  });

  it("keeps public reaction counts for an anonymous viewer", async () => {
    commentCountMock.mockReset();
    commentCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    commentFindManyMock
      .mockResolvedValueOnce([{ id: "root-public" }])
      .mockResolvedValueOnce([comment("root-public")]);
    publicReactionSummaryQueryMock.mockResolvedValue([
      {
        commentId: "root-public",
        count: 2n,
        type: "rocket",
        viewerHasReacted: false,
      },
    ]);

    const result = await loadCommentThread({
      pagination: { pageSize: 20, skip: 0 },
      target: target({ teacherId: 5 }),
      viewer: {
        ...viewer,
        isAuthenticated: false,
        name: null,
        userId: null,
      },
      viewerUserId: null,
    });

    expect(result.comments[0]?.reactions).toEqual([
      { count: 2, type: "rocket", viewerHasReacted: false },
    ]);
    expect(publicReactionSummaryQueryMock).toHaveBeenCalledOnce();
    expect(publicAttachmentSummaryQueryMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).not.toHaveBeenCalled();
  });

  it("does not issue a descendant query for an empty page", async () => {
    commentFindManyMock.mockResolvedValueOnce([]);

    const result = await loadCommentThread({
      pagination: { pageSize: 20, skip: 100 },
      target: target({ courseId: 9 }),
      viewer,
      viewerUserId: viewer.userId,
    });

    expect(result).toMatchObject({ comments: [], hiddenCount: 0, total: 3 });
    expect(commentFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("counts anonymous hidden comments across the target without paging them", async () => {
    commentCountMock.mockReset();
    commentCountMock.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    commentFindManyMock.mockResolvedValueOnce([]);

    const result = await loadCommentThread({
      pagination: { pageSize: 20, skip: 0 },
      target: target({ teacherId: 5 }),
      viewer: {
        ...viewer,
        isAuthenticated: false,
        name: null,
        userId: null,
      },
      viewerUserId: null,
    });

    expect(result).toMatchObject({ comments: [], hiddenCount: 2, total: 1 });
    expect(commentCountMock).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          { teacherId: 5 },
          { visibility: "logged_in_only" },
          { status: { not: "deleted" } },
        ],
      },
    });
  });
});
