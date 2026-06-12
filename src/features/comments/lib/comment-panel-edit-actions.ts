import type { CommentNode } from "@/features/comments/server/comment-types";
import { saveCommentEditRequest } from "./comment-panel-actions";
import {
  type CommentEditDraftState,
  commentEditDraftFromComment,
  emptyCommentEditDraft,
} from "./comment-panel-state";

type CommentEditCopy = {
  submitFailed: string;
};

export function createCommentPanelEditActions(input: {
  applyEditDraftState: (state: CommentEditDraftState) => void;
  getCommentCopy: () => CommentEditCopy;
  getEditAttachmentIds: () => string[];
  getEditDraft: () => string;
  getEditIsAnonymous: () => boolean;
  getEditVisibility: () => string;
  loadComments: () => Promise<void>;
  setActionMenuId: (value: string | null) => void;
  setMessage: (value: string) => void;
}) {
  function startEdit(comment: CommentNode) {
    input.applyEditDraftState(commentEditDraftFromComment(comment));
    input.setActionMenuId(null);
  }

  function cancelEdit() {
    input.applyEditDraftState(emptyCommentEditDraft());
  }

  async function saveEdit(comment: CommentNode) {
    const body = input.getEditDraft().trim();
    if (!body) return;
    const copy = input.getCommentCopy();
    try {
      await saveCommentEditRequest({
        attachmentIds: input.getEditAttachmentIds(),
        body,
        commentId: comment.id,
        isAnonymous: input.getEditIsAnonymous(),
        submitFailed: copy.submitFailed,
        visibility: input.getEditVisibility(),
      });
    } catch (error) {
      input.setMessage(
        error instanceof Error ? error.message : copy.submitFailed,
      );
      return;
    }
    cancelEdit();
    await input.loadComments();
  }

  return {
    cancelEdit,
    saveEdit,
    startEdit,
  };
}
