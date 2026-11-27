import type { CommentNode } from "@/features/comments/server/comment-types";
import { saveCommentEditRequest } from "./comment-panel-actions";
import type { createCommentPanelDefaultState } from "./comment-panel-default-state";
import { createCommentEditDraft } from "./comment-panel-state";

export function createCommentPanelEditActions(input: {
  panel: ReturnType<typeof createCommentPanelDefaultState>;
  getCommentCopy: () => { submitFailed: string };
  loadComments: () => Promise<void>;
  onSuccess?: () => void;
}) {
  const { panel } = input;
  function startEdit(comment: CommentNode) {
    Object.assign(panel, createCommentEditDraft(comment));
    panel.actionMenuId = null;
  }

  function cancelEdit() {
    Object.assign(panel, createCommentEditDraft());
  }

  async function saveEdit(comment: CommentNode) {
    const body = panel.editDraft.trim();
    if (!body || panel.uploadPending.edit > 0) return;
    const copy = input.getCommentCopy();
    try {
      await saveCommentEditRequest({
        attachmentIds: panel.editAttachmentIds,
        body,
        commentId: comment.id,
        isAnonymous: panel.editIsAnonymous,
        submitFailed: copy.submitFailed,
        visibility: panel.editVisibility,
      });
    } catch (error) {
      panel.messageVariant = "destructive";
      panel.message =
        error instanceof Error ? error.message : copy.submitFailed;
      return;
    }
    cancelEdit();
    await input.loadComments();
    input.onSuccess?.();
  }

  return {
    cancelEdit,
    saveEdit,
    startEdit,
  };
}
