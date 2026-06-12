import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { writeClipboardText } from "@/lib/browser/clipboard";
import {
  deleteCommentRequest,
  submitCommentReactionRequest,
} from "./comment-panel-actions";
import { commentPermalinkHref } from "./comment-panel-controller";
import { commentReactionKey } from "./comment-ui";

type CommentInteractionCopy = {
  linkCopied: string;
  loginRequiredDescription: string;
  pleaseRetry: string;
  reactionFailed: string;
  submitFailed: string;
};

export function createCommentPanelInteractions(input: {
  applyReactionUpdate: (
    commentId: string,
    type: string,
    shouldRemove: boolean,
  ) => void;
  getCommentCopy: () => CommentInteractionCopy;
  getCurrentHref: () => string;
  getDeleteTarget: () => CommentNode | null;
  getPendingReactionKey: () => string | null;
  getViewer: () => ViewerContext;
  loadComments: () => Promise<void>;
  setActionMenuId: (value: string | null) => void;
  setDeleteTarget: (value: CommentNode | null) => void;
  setMessage: (value: string) => void;
  setPendingReactionKey: (value: string | null) => void;
  setReactionMenuId: (value: string | null) => void;
}) {
  async function react(comment: CommentNode, type: string) {
    input.setReactionMenuId(null);
    const copy = input.getCommentCopy();
    if (!input.getViewer().isAuthenticated) {
      input.setMessage(copy.loginRequiredDescription);
      return;
    }
    const pendingKey = commentReactionKey(comment.id, type);
    if (input.getPendingReactionKey()) return;
    input.setPendingReactionKey(pendingKey);
    input.setMessage("");
    const existingReaction = comment.reactions.find(
      (reaction) => reaction.type === type,
    );
    const shouldRemove = existingReaction?.viewerHasReacted ?? false;
    try {
      await submitCommentReactionRequest({
        commentId: comment.id,
        reactionFailed: copy.reactionFailed,
        shouldRemove,
        type,
      });
      input.applyReactionUpdate(comment.id, type, shouldRemove);
    } catch (error) {
      input.setMessage(
        error instanceof Error ? error.message : copy.reactionFailed,
      );
    } finally {
      input.setPendingReactionKey(null);
    }
  }

  async function copyCommentLink(comment: CommentNode) {
    input.setActionMenuId(null);
    const copy = input.getCommentCopy();
    try {
      await writeClipboardText(
        commentPermalinkHref(input.getCurrentHref(), comment.id),
      );
      input.setMessage(copy.linkCopied);
    } catch {
      input.setMessage(copy.pleaseRetry);
    }
  }

  function openDeleteDialog(comment: CommentNode) {
    input.setActionMenuId(null);
    input.setDeleteTarget(comment);
  }

  function closeDeleteDialog() {
    input.setDeleteTarget(null);
  }

  async function deleteComment() {
    const deleteTarget = input.getDeleteTarget();
    if (!deleteTarget) return;
    const copy = input.getCommentCopy();
    try {
      await deleteCommentRequest({
        commentId: deleteTarget.id,
        submitFailed: copy.submitFailed,
      });
    } catch (error) {
      input.setMessage(
        error instanceof Error ? error.message : copy.submitFailed,
      );
      return;
    }
    closeDeleteDialog();
    await input.loadComments();
  }

  return {
    closeDeleteDialog,
    copyCommentLink,
    deleteComment,
    openDeleteDialog,
    react,
  };
}
