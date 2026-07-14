import { beforeEach, describe, expect, it, vi } from "vitest";

const { commentCountMock, commentFindManyMock } = vi.hoisted(() => ({
  commentCountMock: vi.fn(),
  commentFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    comment: {
      count: commentCountMock,
      findMany: commentFindManyMock,
    },
  },
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
  overrides: { parentId?: string | null; rootId?: string | null } = {},
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
    user: null,
    userId: null,
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
    commentCountMock.mockResolvedValue(3);
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
