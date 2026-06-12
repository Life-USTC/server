import type { CommentUploadOption } from "./comment-upload-client";

export type CommentUploadState = {
  editAttachmentIds: string[];
  editUploadedFiles: CommentUploadOption[];
  replyAttachmentIds: string[];
  replyUploadedFiles: CommentUploadOption[];
  selectedAttachments: string[];
  uploadedFiles: CommentUploadOption[];
};

export function applyCommentUploadState(
  state: CommentUploadState,
  setters: {
    setEditAttachmentIds: (value: string[]) => void;
    setEditUploadedFiles: (value: CommentUploadOption[]) => void;
    setReplyAttachmentIds: (value: string[]) => void;
    setReplyUploadedFiles: (value: CommentUploadOption[]) => void;
    setSelectedAttachments: (value: string[]) => void;
    setUploadedFiles: (value: CommentUploadOption[]) => void;
  },
) {
  setters.setEditAttachmentIds(state.editAttachmentIds);
  setters.setEditUploadedFiles(state.editUploadedFiles);
  setters.setReplyAttachmentIds(state.replyAttachmentIds);
  setters.setReplyUploadedFiles(state.replyUploadedFiles);
  setters.setSelectedAttachments(state.selectedAttachments);
  setters.setUploadedFiles(state.uploadedFiles);
}
