import { createDefaultCommentViewer } from "@/features/comments/lib/comment-panel-defaults";
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentUploadOption as UploadOption } from "@/features/comments/lib/comment-upload-client";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import type { CommentTargetLoadState } from "./comment-panel-load-data";
import {
  createCommentEditDraft,
  createCommentReplyDraft,
} from "./comment-panel-state";
import { createCommentUploadPendingState } from "./comment-panel-upload-state";

export function createCommentPanelDefaultState() {
  return {
    actionMenuId: null as string | null,
    appliedInitialData: false,
    body: "",
    comments: [] as CommentNodeWithContext[],
    deleteTarget: null as CommentNode | null,
    deleting: false,
    ...createCommentEditDraft(),
    hiddenCount: 0,
    highlightedId: null as string | null,
    isAnonymous: false,
    isDragActive: false,
    loading: true,
    loadingReplyRootId: null as string | null,
    loadingTargetKey: null as string | null,
    message: "",
    messageVariant: "default" as "destructive" | "default",
    pendingReactionKey: null as string | null,
    postTargetKey: "",
    reactionMenuId: null as string | null,
    ...createCommentReplyDraft(),
    selectedAttachments: [] as string[],
    submitting: false,
    targetLoadStates: [] as CommentTargetLoadState[],
    uploadedFiles: [] as UploadOption[],
    uploadPending: createCommentUploadPendingState(),
    viewer: createDefaultCommentViewer() as ViewerContext,
    visibility: "public",
  };
}
