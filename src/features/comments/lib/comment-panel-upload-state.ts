import type { CommentEditorMode } from "./comment-panel-draft-state";
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
