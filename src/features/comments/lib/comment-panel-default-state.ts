import { createDefaultCommentViewer } from "@/features/comments/lib/comment-panel-defaults";
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentUploadOption as UploadOption } from "@/features/comments/lib/comment-upload-client";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export function createCommentPanelDefaultState() {
  return {
    _actionMenuId: null as string | null,
    _appliedInitialData: false,
    _body: "",
    _comments: [] as CommentNodeWithContext[],
    _deleteTarget: null as CommentNode | null,
    _editAttachmentIds: [] as string[],
    _editDraft: "",
    _editIsAnonymous: false,
    _editingId: null as string | null,
    _editUploadedFiles: [] as UploadOption[],
    _editVisibility: "public",
    _hiddenCount: 0,
    _highlightedId: null as string | null,
    _isAnonymous: false,
    _isDragActive: false,
    _loading: true,
    _message: "",
    _pendingReactionKey: null as string | null,
    _postTargetKey: "",
    _reactionMenuId: null as string | null,
    _replyAttachmentIds: [] as string[],
    _replyDraft: "",
    _replyingId: null as string | null,
    _replyIsAnonymous: false,
    _replyUploadedFiles: [] as UploadOption[],
    _replyVisibility: "public",
    _selectedAttachments: [] as string[],
    _submitting: false,
    _uploadedFiles: [] as UploadOption[],
    _uploading: false,
    _viewer: createDefaultCommentViewer() as ViewerContext,
    _visibility: "public",
  };
}
