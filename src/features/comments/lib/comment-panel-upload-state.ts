import type { CommentEditorMode } from "./comment-panel-draft-state";
import type { CommentUploadOption } from "./comment-upload-client";

export type CommentUploadState = {
  editAttachmentIds: string[];
  editUploadedFiles: CommentUploadOption[];
  replyAttachmentIds: string[];
  replyUploadedFiles: CommentUploadOption[];
  selectedAttachments: string[];
  uploadedFiles: CommentUploadOption[];
};

export type CommentUploadPendingState = Record<CommentEditorMode, number>;

export function createCommentUploadPendingState(): CommentUploadPendingState {
  return {
    edit: 0,
    new: 0,
    reply: 0,
  };
}

export function commentUploadPendingForMode(
  state: CommentUploadPendingState,
  mode: CommentEditorMode,
) {
  return state[mode] > 0;
}

export function commentUploadPendingStateWithDelta({
  delta,
  mode,
  state,
}: {
  delta: number;
  mode: CommentEditorMode;
  state: CommentUploadPendingState;
}): CommentUploadPendingState {
  return {
    ...state,
    [mode]: Math.max(0, state[mode] + delta),
  };
}

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
