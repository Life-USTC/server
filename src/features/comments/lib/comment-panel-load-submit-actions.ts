import type { ViewerContext } from "@/lib/auth/viewer-context";
import { submitCommentRequest } from "./comment-panel-actions";
import {
  type CommentTargetLoadState,
  loadCommentRepliesPage,
  loadCommentsForTargets,
  loadCommentThreadPage,
  mergeCommentReplyThread,
  mergeCommentThread,
} from "./comment-panel-data";
import type { CommentEditorMode } from "./comment-panel-draft-state";
import { buildCommentSubmitPayload } from "./comment-panel-submit-payload";
import { visibleCommentsForTargets } from "./comment-panel-target-loading";
import type {
  CommentNodeWithContext,
  CommentTargetOption,
  CommentTargetType,
} from "./comment-ui";
import type { CommentUploadOption } from "./comment-upload-client";

type CommentLoadSubmitCopy = {
  loadFailed: string;
  submitFailed: string;
};

export function createCommentPanelLoadSubmitActions(input: {
  cancelReply: () => void;
  getBody: () => string;
  getCommentCopy: () => CommentLoadSubmitCopy;
  getComments: () => CommentNodeWithContext[];
  getIsAnonymous: () => boolean;
  getReplyAttachmentIds: () => string[];
  getReplyIsAnonymous: () => boolean;
  getReplyVisibility: () => string;
  getSelectedAttachments: () => string[];
  getShowAllTargets: () => boolean;
  getSubmitting: () => boolean;
  getTargetLoadStates: () => CommentTargetLoadState[];
  getTargetType: () => CommentTargetType;
  getTargets: () => CommentTargetOption[];
  getVisibility: () => string;
  hasPendingUploads: (mode: CommentEditorMode) => boolean;
  scrollToHashComment: () => Promise<void>;
  selectedPostTarget: () => CommentTargetOption | null;
  onSuccess?: (mode: "comment" | "reply") => void;
  setBody: (value: string) => void;
  setComments: (value: CommentNodeWithContext[]) => void;
  setHiddenCount: (value: number) => void;
  setLoading: (value: boolean) => void;
  setLoadingReplyRootId: (value: string | null) => void;
  setLoadingTargetKey: (value: string | null) => void;
  setMessage: (value: string) => void;
  setMessageVariant: (value: "destructive" | "default") => void;
  setSelectedAttachments: (value: string[]) => void;
  setSubmitting: (value: boolean) => void;
  setTargetLoadStates: (value: CommentTargetLoadState[]) => void;
  setUploadedFiles: (value: CommentUploadOption[]) => void;
  setViewer: (value: ViewerContext) => void;
}) {
  function currentTargetStates() {
    const previous = new Map(
      input.getTargetLoadStates().map((state) => [state.target.key, state]),
    );
    return input.getTargets().map(
      (target): CommentTargetLoadState =>
        previous.get(target.key) ?? {
          comments: [],
          hiddenCount: 0,
          loaded: false,
          page: 0,
          target,
          total: 0,
          totalPages: 0,
        },
    );
  }

  function applyTargetEntries(
    entries: Awaited<ReturnType<typeof loadCommentsForTargets>>["entries"],
    replace: boolean,
  ) {
    const states = currentTargetStates();
    const statesByKey = new Map(
      states.map((state) => [state.target.key, state]),
    );
    for (const entry of entries) {
      const previous = statesByKey.get(entry.target.key);
      statesByKey.set(entry.target.key, {
        comments:
          replace || !previous
            ? entry.comments
            : mergeCommentPages(previous.comments, entry.comments),
        hiddenCount: entry.hiddenCount,
        loaded: true,
        page: entry.page,
        target: entry.target,
        total: entry.total,
        totalPages: entry.totalPages,
      });
    }
    const nextStates = states.map(
      (state) => statesByKey.get(state.target.key) ?? state,
    );
    input.setTargetLoadStates(nextStates);
    input.setComments(
      visibleCommentsForTargets({
        showAllTargets: input.getShowAllTargets(),
        targetComments: Object.fromEntries(
          nextStates.map((state) => [state.target.key, state.comments]),
        ),
        targets: input.getTargets(),
      }),
    );
    input.setHiddenCount(
      nextStates.reduce((total, state) => total + state.hiddenCount, 0),
    );
  }

  async function loadTargetPages(
    targetKeys: string[],
    pageByTarget: Record<string, number>,
    replace: boolean,
  ) {
    const copy = input.getCommentCopy();
    const result = await loadCommentsForTargets({
      loadFailed: copy.loadFailed,
      pageByTarget,
      showAllTargets: input.getShowAllTargets(),
      targetKeys,
      targets: input.getTargets(),
    });
    applyTargetEntries(result.entries, replace);
    if (result.viewer) input.setViewer(result.viewer);
  }

  async function loadComments() {
    input.setLoading(true);
    input.setMessage("");
    input.setMessageVariant("default");
    const copy = input.getCommentCopy();
    try {
      const states = currentTargetStates();
      const loadedKeys = states
        .filter((state) => state.loaded)
        .map((state) => state.target.key);
      const targetKeys =
        loadedKeys.length > 0
          ? loadedKeys
          : states
              .filter(
                (state) =>
                  state.target.type !== "section-teacher" ||
                  state.target.teacherId,
              )
              .slice(0, 1)
              .map((state) => state.target.key);
      await loadTargetPages(
        targetKeys,
        Object.fromEntries(targetKeys.map((key) => [key, 1])),
        true,
      );
      await input.scrollToHashComment();
    } catch (error) {
      input.setMessageVariant("destructive");
      input.setMessage(
        error instanceof Error ? error.message : copy.loadFailed,
      );
    } finally {
      input.setLoading(false);
    }
  }

  async function loadTarget(targetKey: string) {
    if (
      input
        .getTargetLoadStates()
        .some((state) => state.target.key === targetKey && state.loaded)
    ) {
      return;
    }
    await loadTargetPage(targetKey, 1, true);
  }

  async function loadMoreComments(targetKey: string) {
    const state = input
      .getTargetLoadStates()
      .find((entry) => entry.target.key === targetKey);
    if (!state?.loaded || state.page >= state.totalPages) return;
    await loadTargetPage(targetKey, state.page + 1, false);
  }

  async function loadTargetPage(
    targetKey: string,
    page: number,
    replace: boolean,
  ) {
    if (
      input
        .getTargetLoadStates()
        .some(
          (state) =>
            state.target.key === targetKey &&
            state.loaded &&
            state.page === page,
        )
    ) {
      return;
    }
    const copy = input.getCommentCopy();
    input.setLoadingTargetKey(targetKey);
    input.setMessage("");
    input.setMessageVariant("default");
    try {
      await loadTargetPages([targetKey], { [targetKey]: page }, replace);
    } catch (error) {
      input.setMessageVariant("destructive");
      input.setMessage(
        error instanceof Error ? error.message : copy.loadFailed,
      );
    } finally {
      input.setLoadingTargetKey(null);
    }
  }

  async function loadMoreReplies(rootId: string) {
    const root = findComment(input.getComments(), rootId);
    const cursor = root?.repliesNextCursor;
    if (!cursor) return;
    const target = input
      .getTargets()
      .find((entry) => entry.key === root?.contextKey);
    if (!target) return;

    const copy = input.getCommentCopy();
    input.setLoadingReplyRootId(rootId);
    input.setMessage("");
    input.setMessageVariant("default");
    try {
      const result = await loadCommentRepliesPage({
        cursor,
        loadFailed: copy.loadFailed,
        rootId,
      });
      input.setComments(
        mergeCommentReplyThread({
          comments: input.getComments(),
          rootId,
          showAllTargets: input.getShowAllTargets(),
          target,
          thread: result.thread,
        }),
      );
      input.setTargetLoadStates(
        input.getTargetLoadStates().map((state) =>
          state.target.key === target.key
            ? {
                ...state,
                comments: mergeCommentReplyThread({
                  comments: state.comments,
                  rootId,
                  showAllTargets: input.getShowAllTargets(),
                  target,
                  thread: result.thread,
                }),
              }
            : state,
        ),
      );
      input.setViewer(result.viewer);
    } catch (error) {
      input.setMessageVariant("destructive");
      input.setMessage(
        error instanceof Error ? error.message : copy.loadFailed,
      );
    } finally {
      input.setLoadingReplyRootId(null);
    }
  }

  async function refreshAfterSubmit(
    commentId: string,
    target: CommentTargetOption,
  ) {
    let initialLoadError: unknown;
    const state = input
      .getTargetLoadStates()
      .find((entry) => entry.target.key === target.key);
    if (!state?.loaded) {
      try {
        await loadTargetPages([target.key], { [target.key]: 1 }, true);
      } catch (error) {
        initialLoadError = error;
      }
    }

    const result = await loadCommentThreadPage({
      commentId,
      loadFailed: input.getCommentCopy().loadFailed,
    });
    const states = currentTargetStates();
    const nextStates = states.map((state) =>
      state.target.key === target.key
        ? {
            ...state,
            comments: mergeCommentThread({
              comments: state.comments,
              showAllTargets: input.getShowAllTargets(),
              target,
              thread: result.thread,
            }),
          }
        : state,
    );
    input.setTargetLoadStates(nextStates);
    input.setComments(
      visibleCommentsForTargets({
        showAllTargets: input.getShowAllTargets(),
        targetComments: Object.fromEntries(
          nextStates.map((state) => [state.target.key, state.comments]),
        ),
        targets: input.getTargets(),
      }),
    );
    input.setViewer(result.viewer);
    if (initialLoadError) throw initialLoadError;
  }

  async function submitComment(
    parentId?: string | null,
    replyBody?: string,
    target: CommentTargetOption | null = input.selectedPostTarget(),
  ) {
    const body = (replyBody ?? input.getBody()).trim();
    const mode = parentId ? "reply" : "new";
    if (!body || input.getSubmitting() || input.hasPendingUploads(mode)) return;
    input.setSubmitting(true);
    input.setMessage("");
    input.setMessageVariant("default");
    const copy = input.getCommentCopy();
    try {
      const createdCommentId = await submitCommentRequest(
        buildCommentSubmitPayload({
          body,
          getIsAnonymous: input.getIsAnonymous,
          getReplyAttachmentIds: input.getReplyAttachmentIds,
          getReplyIsAnonymous: input.getReplyIsAnonymous,
          getReplyVisibility: input.getReplyVisibility,
          getSelectedAttachments: input.getSelectedAttachments,
          getTargetType: input.getTargetType,
          getVisibility: input.getVisibility,
          parentId: parentId ?? undefined,
          submitFailed: copy.submitFailed,
          target,
        }),
      );
      input.setBody("");
      input.cancelReply();
      input.setSelectedAttachments([]);
      input.setUploadedFiles([]);
      input.onSuccess?.(mode === "new" ? "comment" : "reply");
      if (target) {
        try {
          await refreshAfterSubmit(createdCommentId, target);
        } catch (error) {
          input.setMessageVariant("destructive");
          input.setMessage(
            error instanceof Error ? error.message : copy.loadFailed,
          );
        }
      }
    } catch (error) {
      input.setMessageVariant("destructive");
      input.setMessage(
        error instanceof Error ? error.message : copy.submitFailed,
      );
    } finally {
      input.setSubmitting(false);
    }
  }

  return {
    loadComments,
    loadMoreComments,
    loadMoreReplies,
    loadTarget,
    submitComment,
  };
}

function mergeCommentPages(
  existing: CommentNodeWithContext[],
  incoming: CommentNodeWithContext[],
) {
  const byId = new Map(existing.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const previous = byId.get(comment.id);
    byId.set(
      comment.id,
      previous
        ? {
            ...previous,
            ...comment,
            ...(previous.isAncestryPlaceholder && comment.isAncestryPlaceholder
              ? {
                  createdAt: previous.createdAt,
                  updatedAt: previous.updatedAt,
                }
              : {}),
            replies: mergeReplyNodes(previous.replies, comment.replies),
          }
        : comment,
    );
  }
  return sortCommentNodes(Array.from(byId.values()));
}

function mergeReplyNodes(
  existing: CommentNodeWithContext[],
  incoming: CommentNodeWithContext[],
) {
  const byId = new Map(existing.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const previous = byId.get(comment.id);
    byId.set(
      comment.id,
      previous
        ? {
            ...previous,
            ...comment,
            ...(previous.isAncestryPlaceholder && comment.isAncestryPlaceholder
              ? {
                  createdAt: previous.createdAt,
                  updatedAt: previous.updatedAt,
                }
              : {}),
            replies: mergeReplyNodes(previous.replies, comment.replies),
          }
        : comment,
    );
  }
  return sortCommentNodes(Array.from(byId.values()));
}

function sortCommentNodes(
  nodes: CommentNodeWithContext[],
): CommentNodeWithContext[] {
  return nodes
    .map((node) => ({ ...node, replies: sortCommentNodes(node.replies) }))
    .sort((a, b) => {
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
}

function findComment(
  comments: CommentNodeWithContext[],
  id: string,
): CommentNodeWithContext | null {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const nested = findComment(comment.replies, id);
    if (nested) return nested;
  }
  return null;
}
