import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";

const apiClientMock = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ apiClient: apiClientMock }));

import {
  loadCommentRepliesPage,
  loadCommentsForTargets,
  mergeCommentReplyThread,
} from "@/features/comments/lib/comment-panel-load-data";
import type { CommentNode } from "@/features/comments/server/comment-types";

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

const targetMetadata = {
  courseId: null,
  courseJwId: null,
  courseName: null,
  homeworkId: null,
  homeworkSectionCode: null,
  homeworkSectionJwId: null,
  homeworkTitle: null,
  sectionCode: null,
  sectionId: 1,
  sectionJwId: 1,
  sectionTeacherCourseJwId: null,
  sectionTeacherCourseName: null,
  sectionTeacherId: null,
  sectionTeacherSectionCode: null,
  sectionTeacherSectionId: null,
  sectionTeacherSectionJwId: null,
  sectionTeacherTeacherId: null,
  sectionTeacherTeacherName: null,
  targetId: 1,
  teacherId: null,
  teacherName: null,
  type: "section",
};

const targets: CommentTargetOption[] = [
  {
    key: "section",
    label: "Section",
    sectionId: 1,
    targetId: 1,
    type: "section",
  },
  {
    key: "course",
    label: "Course",
    targetId: 2,
    type: "course",
  },
  {
    key: "teacher",
    label: "Teacher",
    targetId: 3,
    type: "teacher",
  },
];

function listResponse(page: number, totalPages = 4) {
  return {
    data: [],
    meta: { hiddenCount: 0, target: targetMetadata, viewer },
    pagination: { page, pageSize: 20, total: totalPages * 20, totalPages },
  };
}

function node(id: string, overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    attachments: [],
    author: null,
    authorHidden: false,
    body: id,
    canDelete: false,
    canEdit: false,
    canModerate: false,
    canReact: false,
    canReply: false,
    createdAt: "2026-01-01T00:00:00+08:00",
    id,
    isAnonymous: false,
    isAuthor: false,
    parentId: null,
    reactions: [],
    replies: [],
    repliesNextCursor: null,
    renderedBody: `<p>${id}</p>`,
    rootId: id,
    status: "active",
    updatedAt: "2026-01-01T00:00:00+08:00",
    visibility: "public",
    ...overrides,
  };
}

describe("comment panel bounded loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMock.GET.mockImplementation(async (path: string) => {
      const url = new URL(path, "https://life.test");
      const page = Number(url.searchParams.get("page") ?? 1);
      return {
        data: listResponse(page),
        response: new Response(null, { status: 200 }),
      };
    });
  });

  it("loads one initial target page instead of fanning out across targets/pages", async () => {
    const result = await loadCommentsForTargets({
      loadFailed: "load failed",
      showAllTargets: true,
      targets,
    });

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(apiClientMock.GET.mock.calls[0]?.[0]).toContain(
      "targetType=section",
    );
    expect(apiClientMock.GET.mock.calls[0]?.[0]).toContain("page=1");
    expect(apiClientMock.GET.mock.calls[0]?.[0]).toContain("pageSize=20");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.target.key).toBe("section");
  });

  it("only requests explicitly selected target pages for continuation", async () => {
    const result = await loadCommentsForTargets({
      loadFailed: "load failed",
      pageByTarget: { course: 3, teacher: 2 },
      showAllTargets: true,
      targetKeys: ["course", "teacher"],
      targets,
    });

    expect(apiClientMock.GET).toHaveBeenCalledTimes(2);
    expect(apiClientMock.GET.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/community/comments?targetType=course&targetId=2&pageSize=20&page=3",
      "/api/community/comments?targetType=teacher&targetId=3&pageSize=20&page=2",
    ]);
    expect(result.entries.map((entry) => entry.page).sort()).toEqual([2, 3]);
  });

  it("passes one reply cursor request through the continuation endpoint", async () => {
    apiClientMock.GET.mockResolvedValueOnce({
      data: {
        nextCursor: null,
        rootId: "root-1",
        thread: [node("root-1")],
        viewer,
      },
      response: new Response(null, { status: 200 }),
    });

    await loadCommentRepliesPage({
      cursor: "cursor-value",
      loadFailed: "load failed",
      rootId: "root/1",
    });

    expect(apiClientMock.GET).toHaveBeenCalledWith(
      "/api/community/comments/root%2F1/replies?cursor=cursor-value&pageSize=20",
    );
  });

  it("merges a continuation page once and preserves reply ordering", () => {
    const target = targets[0];
    if (!target) throw new Error("missing target");
    const existing = [
      node("root-1", {
        replies: [
          node("reply-2", {
            createdAt: "2026-01-01T00:00:02+08:00",
            parentId: "root-1",
            rootId: "root-1",
          }),
        ],
        repliesNextCursor: "cursor-1",
      }),
    ];
    const incomingRoot = node("root-1", {
      replies: [
        node("reply-1", {
          createdAt: "2026-01-01T00:00:01+08:00",
          parentId: "root-1",
          rootId: "root-1",
        }),
        node("reply-2", {
          createdAt: "2026-01-01T00:00:02+08:00",
          parentId: "root-1",
          rootId: "root-1",
        }),
      ],
      repliesNextCursor: null,
    });

    const result = mergeCommentReplyThread({
      comments: existing.map((comment) => ({
        ...comment,
        contextKey: target.key,
        replies: comment.replies.map((reply) => ({
          ...reply,
          contextKey: target.key,
          replies: [],
        })),
      })),
      rootId: "root-1",
      showAllTargets: true,
      target,
      thread: [incomingRoot],
    });

    expect(result[0]?.replies.map((reply) => reply.id)).toEqual([
      "reply-1",
      "reply-2",
    ]);
    expect(result[0]?.repliesNextCursor).toBeNull();
  });
});
