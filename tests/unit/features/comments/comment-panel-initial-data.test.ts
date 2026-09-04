import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommentTargetLoadState } from "@/features/comments/lib/comment-panel-data";
import { createCommentPanelInitialDataActions } from "@/features/comments/lib/comment-panel-initial-data-actions";
import { mountCommentPanel } from "@/features/comments/lib/comment-panel-mount";
import type {
  CommentNodeWithContext,
  CommentTargetOption,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";

afterEach(() => {
  vi.unstubAllGlobals();
});

const viewer: ViewerContext = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

const sectionTarget: CommentTargetOption = {
  key: "section",
  label: "Section",
  sectionId: 11,
  targetId: 11,
  type: "section",
};

const courseTarget: CommentTargetOption = {
  key: "course",
  label: "Course",
  targetId: 22,
  type: "course",
};

const sectionTeacherTarget: CommentTargetOption = {
  key: "section-teacher",
  label: "Teacher",
  sectionId: 11,
  teacherId: 33,
  type: "section-teacher",
};

function comment(): CommentNode {
  return {
    attachments: [],
    author: null,
    authorHidden: false,
    body: "comment",
    canDelete: false,
    canEdit: false,
    canModerate: false,
    canReact: false,
    canReply: false,
    createdAt: "2026-01-01T00:00:00+08:00",
    id: "section-comment",
    isAnonymous: true,
    isAuthor: false,
    parentId: null,
    reactions: [],
    replies: [],
    repliesNextCursor: null,
    renderedBody: "<p>comment</p>",
    rootId: "section-comment",
    status: "active",
    updatedAt: "2026-01-01T00:00:00+08:00",
    visibility: "public",
  };
}

describe("comment panel initial SSR state", () => {
  it("keeps the primary SSR target loaded and exposes secondary targets for on-demand loading", () => {
    const setComments = vi.fn<(value: CommentNodeWithContext[]) => void>();
    const setTargetLoadStates =
      vi.fn<(value: CommentTargetLoadState[]) => void>();
    const actions = createCommentPanelInitialDataActions({
      getResolvedTargets: () => [
        sectionTarget,
        courseTarget,
        sectionTeacherTarget,
      ],
      getShowAllTargets: () => true,
      setComments,
      setHiddenCount: vi.fn(),
      setLoading: vi.fn(),
      setTargetLoadStates,
      setViewer: vi.fn(),
    });

    actions.applyInitialData({
      commentMap: { section: [comment()] },
      complete: true,
      hiddenCount: 1,
      hiddenMap: { section: 1 },
      viewer,
    });

    const states = setTargetLoadStates.mock.calls[0]?.[0] ?? [];
    expect(states).toHaveLength(3);
    expect(states[0]).toMatchObject({
      comments: [expect.objectContaining({ id: "section-comment" })],
      loaded: true,
      page: 1,
      target: sectionTarget,
      total: 1,
      totalPages: 1,
    });
    expect(states.slice(1)).toEqual([
      expect.objectContaining({
        comments: [],
        loaded: false,
        page: 0,
        target: courseTarget,
        total: 0,
        totalPages: 0,
      }),
      expect.objectContaining({
        comments: [],
        loaded: false,
        page: 0,
        target: sectionTeacherTarget,
        total: 0,
        totalPages: 0,
      }),
    ]);
    expect(setComments).toHaveBeenCalledWith([
      expect.objectContaining({
        contextKey: sectionTarget.key,
        id: "section-comment",
      }),
    ]);
  });

  it("does not refetch a complete SSR panel on mount", async () => {
    const loadComments = vi.fn();
    const scrollToHashComment = vi.fn();
    const waitForDom = vi.fn(async () => {});
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const cleanup = mountCommentPanel({
      clearHashScroller: vi.fn(),
      hasInitialData: true,
      loadComments,
      scrollToHashComment,
      waitForDom,
    });
    await Promise.resolve();

    expect(loadComments).not.toHaveBeenCalled();
    expect(waitForDom).toHaveBeenCalledOnce();
    expect(scrollToHashComment).toHaveBeenCalledOnce();
    cleanup();
  });
});
