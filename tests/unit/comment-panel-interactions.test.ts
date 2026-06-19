import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommentPanelInteractions } from "@/features/comments/lib/comment-panel-interactions";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";

function comment(overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id: "comment-1",
    body: "body",
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
    canReply: false,
    canEdit: false,
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

describe("comment panel interactions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks suspended reactions before submitting a request", async () => {
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
      getCurrentHref: () => "https://life.example/sections/1",
      getDeleteTarget: () => null,
      getPendingReactionKey: () => null,
      getViewer: () => viewer({ isSuspended: true }),
      loadComments: vi.fn(),
      setActionMenuId: vi.fn(),
      setDeleteTarget: vi.fn(),
      setMessage: (value) => {
        message = value;
      },
      setPendingReactionKey,
      setReactionMenuId: vi.fn(),
    });

    await interactions.react(comment(), "upvote");

    expect(message).toBe("suspended");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setPendingReactionKey).not.toHaveBeenCalled();
    expect(applyReactionUpdate).not.toHaveBeenCalled();
  });
});
