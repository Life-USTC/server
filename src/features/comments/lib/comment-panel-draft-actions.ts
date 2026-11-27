import type { CommentNode } from "@/features/comments/server/comment-types";
import type { createCommentPanelDefaultState } from "./comment-panel-default-state";
import type { CommentEditorMode } from "./comment-panel-draft-state";
import {
  createCommentReplyDraft,
  removeCommentUpload,
} from "./comment-panel-state";
import { appendMarkdown } from "./comment-ui";

export function createCommentPanelDraftActions(
  panel: ReturnType<typeof createCommentPanelDefaultState>,
) {
  const draftKeys = {
    new: "body",
    edit: "editDraft",
    reply: "replyDraft",
  } as const;

  function replaceMarkdownToken(
    token: string,
    replacement: string,
    mode: CommentEditorMode = "new",
  ) {
    const key = draftKeys[mode];
    panel[key] = panel[key].replace(token, replacement);
  }

  function insertMarkdown(value: string, mode: CommentEditorMode = "new") {
    const key = draftKeys[mode];
    panel[key] = appendMarkdown(value, panel[key]);
  }

  function removeAttachment(uploadId: string) {
    const next = removeCommentUpload(uploadId, {
      attachmentIds: panel.selectedAttachments,
      uploadedFiles: panel.uploadedFiles,
    });
    panel.selectedAttachments = next.attachmentIds;
    panel.uploadedFiles = next.uploadedFiles;
  }

  function removeReplyAttachment(uploadId: string) {
    const next = removeCommentUpload(uploadId, {
      attachmentIds: panel.replyAttachmentIds,
      uploadedFiles: panel.replyUploadedFiles,
    });
    panel.replyAttachmentIds = next.attachmentIds;
    panel.replyUploadedFiles = next.uploadedFiles;
  }

  function cancelReply() {
    Object.assign(panel, createCommentReplyDraft());
  }

  function toggleReply(comment: CommentNode) {
    Object.assign(
      panel,
      createCommentReplyDraft(
        panel.replyingId === comment.id ? null : comment.id,
      ),
    );
  }

  return {
    cancelReply,
    insertMarkdown,
    removeAttachment,
    removeReplyAttachment,
    replaceMarkdownToken,
    toggleReply,
  };
}
