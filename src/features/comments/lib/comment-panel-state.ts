import type { CommentNode } from "@/features/comments/server/comment-types";
import type { CommentUploadOption } from "./comment-upload-client";

export type CommentUploadDraftState = {
  attachmentIds: string[];
  uploadedFiles: CommentUploadOption[];
};

export function removeCommentUpload(
  uploadId: string,
  state: CommentUploadDraftState,
): CommentUploadDraftState {
  return {
    attachmentIds: state.attachmentIds.filter((id) => id !== uploadId),
    uploadedFiles: state.uploadedFiles.filter((file) => file.id !== uploadId),
  };
}

export function createCommentReplyDraft(replyingId: string | null = null) {
  return {
    replyingId,
    replyDraft: "",
    replyIsAnonymous: false,
    replyVisibility: "public",
    replyAttachmentIds: [] as string[],
    replyUploadedFiles: [] as CommentUploadOption[],
  };
}

export function createCommentEditDraft(comment?: CommentNode) {
  return {
    editingId: comment?.id ?? null,
    editDraft: comment?.body ?? "",
    editVisibility:
      comment?.visibility === "logged_in_only" ? "logged_in_only" : "public",
    editIsAnonymous: comment?.isAnonymous ?? false,
    editAttachmentIds:
      comment?.attachments.map((attachment) => attachment.uploadId) ?? [],
    editUploadedFiles: [] as CommentUploadOption[],
  };
}
