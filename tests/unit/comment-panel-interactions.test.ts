import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommentPanelInteractions } from "@/features/comments/lib/comment-panel-interactions";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { createDeferred } from "../shared/deferred";

function comment(overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id: "comment-1",
    body: "body",
    renderedBody: "<p>body</p>",
    visibility: "public",
    status: "active",
    author: null,
    authorHidden: false,
    isAnonymous: false,
    isAuthor: false,
    createdAt: "2026-01-01T00:00:00+08:00",
    updatedAt: "2026-01-01T00:00:00+08:00",
    parentId: null,
    rootId: "comment-1",
    replies: [],
    attachments: [],
    reactions: [],
    canReact: false,
    canReply: false,
    canEdit: false,
    canDelete: false,
    canModerate: false,
    ...overrides,
  };
}

function viewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    userId: "user-1",
    name: "Viewer",
    image: null,
    isAdmin: false,
    isAuthenticated: true,
    isSuspended: false,
    suspensionReason: null,
    suspensionExpiresAt: null,
    ...overrides,
  };
}

describe("评论面板交互", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("在提交请求前阻止被暂停用户的反应", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    let message = "";
    const applyReactionUpdate = vi.fn();
    const setPendingReactionKey = vi.fn();

    const interactions = createCommentPanelInteractions({
      applyReactionUpdate,
      getCommentCopy: () => ({
        linkCopied: "copied",
        loginRequiredDescription: "login required",
        pleaseRetry: "retry",
        reactionFailed: "reaction failed",
        submitFailed: "submit failed",
        suspendedMessage: "suspended",
      }),
      getCurrentHref: () => "https://life.example/catalog/sections/1",
      getDeleteTarget: () => null,
      getPendingReactionKey: () => null,
      getViewer: () => viewer({ isSuspended: true }),
      loadComments: vi.fn(),
      setActionMenuId: vi.fn(),
      setDeleteTarget: vi.fn(),
      setDeleting: vi.fn(),
      setMessage: (value) => {
        message = value;
      },
      setMessageVariant: vi.fn(),
      setPendingReactionKey,
      setReactionMenuId: vi.fn(),
    });

    await interactions.react(comment(), "upvote");

    expect(message).toBe("suspended");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setPendingReactionKey).not.toHaveBeenCalled();
    expect(applyReactionUpdate).not.toHaveBeenCalled();
  });

  it("删除请求成功后立即反馈，不等待评论列表重新加载", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "comment-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const events: string[] = [];
    const reload = createDeferred();

    const interactions = createCommentPanelInteractions({
      applyReactionUpdate: vi.fn(),
      getCommentCopy: () => ({
        linkCopied: "copied",
        loginRequiredDescription: "login required",
        pleaseRetry: "retry",
        reactionFailed: "reaction failed",
        submitFailed: "submit failed",
        suspendedMessage: "suspended",
      }),
      getCurrentHref: () => "https://life.example/catalog/sections/1",
      getDeleteTarget: () => comment(),
      getPendingReactionKey: () => null,
      getViewer: () => viewer(),
      loadComments: async () => {
        events.push("reload-started");
        await reload.promise;
      },
      onSuccess: (action) => events.push(`success:${action}`),
      setActionMenuId: vi.fn(),
      setDeleteTarget: vi.fn(),
      setDeleting: vi.fn(),
      setMessage: vi.fn(),
      setMessageVariant: vi.fn(),
      setPendingReactionKey: vi.fn(),
      setReactionMenuId: vi.fn(),
    });

    const deletion = interactions.deleteComment();
    await vi.waitFor(() => {
      expect(events).toEqual(["success:delete", "reload-started"]);
    });
    reload.resolve();
    await deletion;
  });
});
