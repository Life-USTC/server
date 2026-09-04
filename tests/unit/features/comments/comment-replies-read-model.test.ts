import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  accountFindManyMock,
  findManyMock,
  findUniqueMock,
  getViewerContextMock,
  queryRawMock,
  withCommentDbContextMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  accountFindManyMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  queryRawMock: vi.fn(),
  withCommentDbContextMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));
vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    account: { findMany: accountFindManyMock },
  },
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
  withUserDbContext: withUserDbContextMock,
}));
vi.mock("@/features/comments/server/comment-db-context", () => ({
  withCommentDbContext: withCommentDbContextMock,
}));
vi.mock("@/lib/db/rls-context", () => ({
  getUserRlsTransactionClient: vi.fn(() => null),
}));

import { loadCommentReplies } from "@/features/comments/server/comment-read-model";
import {
  decodeCommentReplyCursor,
  encodeCommentReplyCursor,
} from "@/features/comments/server/comment-reply-pagination";

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

const baseTime = new Date("2026-01-01T00:00:00.000Z");

function comment(
  id: string,
  overrides: {
    parentId?: string | null;
    rootId?: string | null;
    createdAt?: Date;
  } = {},
) {
  return {
    attachments: [],
    body: id,
    createdAt: overrides.createdAt ?? baseTime,
    id,
    isAnonymous: false,
    parentId: overrides.parentId ?? null,
    reactions: [],
    rootId: overrides.rootId ?? "root-1",
    status: "active" as const,
    updatedAt: overrides.createdAt ?? baseTime,
    user: null,
    userId: null,
    visibility: "public" as const,
  };
}

function windowRow(
  id: string,
  rowNumber: bigint | null,
  parentId: string | null,
) {
  return {
    createdAt: new Date(baseTime.getTime() + Number(rowNumber ?? 0) + 1),
    id,
    parentId,
    rootId: "root-1",
    rowNumber,
  };
}

describe("loadCommentReplies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewerContextMock.mockResolvedValue(viewer);
    accountFindManyMock.mockResolvedValue([]);
    withCommentDbContextMock.mockImplementation((_userId, callback) =>
      callback({
        $queryRaw: queryRawMock,
        comment: { findMany: findManyMock, findUnique: findUniqueMock },
      }),
    );
    withUserDbContextMock.mockImplementation((_userId, callback) =>
      callback({ $queryRaw: queryRawMock }),
    );
    findUniqueMock.mockImplementation((input) =>
      input.select
        ? Promise.resolve({ id: "reply-3", rootId: "root-1" })
        : Promise.resolve(comment("root-1")),
    );
    queryRawMock.mockImplementation((query) => {
      const sql = query?.strings?.join(" ") ?? "";
      if (sql.includes("reply_window")) {
        return Promise.resolve(replyWindowRows.shift() ?? []);
      }
      return Promise.resolve([]);
    });
  });

  it("continues a bounded page without duplicates and keeps nested ancestry", async () => {
    replyWindowRows.push(
      [
        windowRow("reply-1", 1n, "root-1"),
        windowRow("reply-2", 2n, "reply-1"),
        windowRow("reply-3", 3n, "reply-2"),
      ],
      [
        windowRow("reply-3", 1n, "reply-2"),
        windowRow("reply-4", 2n, "reply-3"),
        windowRow("reply-2", null, "reply-1"),
        windowRow("reply-1", null, "root-1"),
      ],
    );
    findManyMock
      .mockResolvedValueOnce([
        comment("reply-1", { parentId: "root-1" }),
        comment("reply-2", { parentId: "reply-1" }),
      ])
      .mockResolvedValueOnce([
        comment("reply-1", { parentId: "root-1" }),
        comment("reply-2", { parentId: "reply-1" }),
        comment("reply-3", { parentId: "reply-2" }),
        comment("reply-4", { parentId: "reply-3" }),
      ]);

    const first = await loadCommentReplies({
      commentId: "root-1",
      pageSize: 2,
      viewerUserId: viewer.userId,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.thread[0]).toMatchObject({
      id: "root-1",
      replies: [
        {
          id: "reply-1",
          replies: [{ id: "reply-2" }],
        },
      ],
    });
    expect(decodeCommentReplyCursor(first.nextCursor ?? "")).toMatchObject({
      id: "reply-2",
      rootId: "root-1",
    });

    const second = await loadCommentReplies({
      commentId: "reply-3",
      cursor: first.nextCursor,
      pageSize: 2,
      viewerUserId: viewer.userId,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.nextCursor).toBeNull();
    expect(second.thread[0]).toMatchObject({
      id: "root-1",
      replies: [
        {
          id: "reply-1",
          replies: [
            {
              id: "reply-2",
              replies: [{ id: "reply-3", replies: [{ id: "reply-4" }] }],
            },
          ],
        },
      ],
    });
    expect(nodeIds(second.thread)).toEqual([
      "root-1",
      "reply-1",
      "reply-2",
      "reply-3",
      "reply-4",
    ]);
  });

  it("rejects a cursor from another root before loading reply rows", async () => {
    const result = await loadCommentReplies({
      commentId: "root-1",
      cursor: encodeCommentReplyCursor({
        createdAt: baseTime.toISOString(),
        id: "reply-1",
        rootId: "other-root",
      }),
      viewerUserId: viewer.userId,
    });

    expect(result).toEqual({ ok: false, error: "invalid_cursor" });
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});

const replyWindowRows: Array<ReturnType<typeof windowRow>[]> = [];

type TreeNode = { id: string; replies: TreeNode[] };

function nodeIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...nodeIds(node.replies)]);
}
