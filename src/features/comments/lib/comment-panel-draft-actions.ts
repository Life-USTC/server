import type { CommentNode } from "@/features/comments/server/comment-types";
import {
  type CommentEditorMode,
  commentDraftReplacingToken,
  commentDraftWithMarkdown,
} from "./comment-panel-controller";
import {
  type CommentReplyDraftState,
  emptyCommentReplyDraft,
  removeCommentUpload,
  toggledCommentReplyDraft,
} from "./comment-panel-state";
import { appendMarkdown } from "./comment-ui";
import type { CommentUploadOption } from "./comment-upload-client";

export function createCommentPanelDraftActions(input: {
  applyReplyDraftState: (state: CommentReplyDraftState) => void;
  getBody: () => string;
  getEditDraft: () => string;
  getReplyDraft: () => string;
  getReplyingId: () => string | null;
  getReplyUploadedFiles: () => CommentUploadOption[];
  getReplyAttachmentIds: () => string[];
  getSelectedAttachments: () => string[];
  getUploadedFiles: () => CommentUploadOption[];
  setBody: (value: string) => void;
  setEditDraft: (value: string) => void;
  setReplyAttachmentIds: (value: string[]) => void;
  setReplyDraft: (value: string) => void;
  setReplyUploadedFiles: (value: CommentUploadOption[]) => void;
  setSelectedAttachments: (value: string[]) => void;
  setUploadedFiles: (value: CommentUploadOption[]) => void;
}) {
  function replaceMarkdownToken(
    token: string,
    replacement: string,
    mode: CommentEditorMode = "new",
  ) {
    const next = commentDraftReplacingToken({
      body: input.getBody(),
      editDraft: input.getEditDraft(),
      mode,
      replyDraft: input.getReplyDraft(),
      replacement,
      token,
    });
    input.setBody(next.body);
    input.setEditDraft(next.editDraft);
    input.setReplyDraft(next.replyDraft);
  }

  function insertMarkdown(value: string, mode: CommentEditorMode = "new") {
    const next = commentDraftWithMarkdown({
      appendMarkdown,
      body: input.getBody(),
      editDraft: input.getEditDraft(),
      mode,
      replyDraft: input.getReplyDraft(),
      value,
    });
    input.setBody(next.body);
    input.setEditDraft(next.editDraft);
    input.setReplyDraft(next.replyDraft);
  }

  function removeAttachment(uploadId: string) {
    const next = removeCommentUpload(uploadId, {
      attachmentIds: input.getSelectedAttachments(),
      uploadedFiles: input.getUploadedFiles(),
    });
    input.setSelectedAttachments(next.attachmentIds);
    input.setUploadedFiles(next.uploadedFiles);
  }

  function removeReplyAttachment(uploadId: string) {
    const next = removeCommentUpload(uploadId, {
      attachmentIds: input.getReplyAttachmentIds(),
      uploadedFiles: input.getReplyUploadedFiles(),
    });
    input.setReplyAttachmentIds(next.attachmentIds);
    input.setReplyUploadedFiles(next.uploadedFiles);
  }

  function cancelReply() {
    input.applyReplyDraftState(emptyCommentReplyDraft());
  }

  function toggleReply(comment: CommentNode) {
    input.applyReplyDraftState(
      toggledCommentReplyDraft(input.getReplyingId(), comment.id),
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
