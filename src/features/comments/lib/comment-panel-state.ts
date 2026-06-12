import type { CommentNode } from "@/features/comments/server/comment-types";
import type { CommentUploadOption } from "./comment-upload-client";

export type CommentUploadDraftState = {
  attachmentIds: string[];
  uploadedFiles: CommentUploadOption[];
};

export type CommentReplyDraftState = CommentUploadDraftState & {
  draft: string;
  isAnonymous: boolean;
  replyingId: string | null;
  visibility: string;
};

export type CommentEditDraftState = CommentUploadDraftState & {
  draft: string;
  editingId: string | null;
  isAnonymous: boolean;
  visibility: string;
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

export function emptyCommentReplyDraft(): CommentReplyDraftState {
  return {
    attachmentIds: [],
    draft: "",
    isAnonymous: false,
    replyingId: null,
    uploadedFiles: [],
    visibility: "public",
  };
}

export function toggledCommentReplyDraft(
  currentReplyingId: string | null,
  commentId: string,
): CommentReplyDraftState {
  return {
    ...emptyCommentReplyDraft(),
    replyingId: currentReplyingId === commentId ? null : commentId,
  };
}

export function commentEditDraftFromComment(
  comment: CommentNode,
): CommentEditDraftState {
  return {
    attachmentIds: comment.attachments.map((attachment) => attachment.uploadId),
    draft: comment.body,
    editingId: comment.id,
    isAnonymous: comment.isAnonymous,
    uploadedFiles: [],
    visibility:
      comment.visibility === "logged_in_only" ? "logged_in_only" : "public",
  };
}

export function emptyCommentEditDraft(): CommentEditDraftState {
  return {
    attachmentIds: [],
    draft: "",
    editingId: null,
    isAnonymous: false,
    uploadedFiles: [],
    visibility: "public",
  };
}
