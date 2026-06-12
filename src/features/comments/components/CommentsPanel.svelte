<script lang="ts">
import { onMount, tick } from "svelte";
import {
  commentEditAttachmentOptions,
  commentPanelSignInHref,
} from "@/features/comments/lib/comment-panel-controller";
import {
  type CommentsInitialData,
  commentPostTargetOptions,
  resolveCommentTargets,
} from "@/features/comments/lib/comment-panel-data";
import { createCommentPanelDefaultState } from "@/features/comments/lib/comment-panel-default-state";
import { buildCommentVisibilityOptions } from "@/features/comments/lib/comment-panel-defaults";
import { createCommentPanelDisplayActions } from "@/features/comments/lib/comment-panel-display-actions";
import { createCommentPanelDraftActions } from "@/features/comments/lib/comment-panel-draft-actions";
import { createCommentPanelEditActions } from "@/features/comments/lib/comment-panel-edit-actions";
import { createCommentPanelEditorEventActions } from "@/features/comments/lib/comment-panel-editor-event-actions";
import { createCommentHashScroller } from "@/features/comments/lib/comment-panel-hash-scroll";
import { createCommentPanelInitialDataActions } from "@/features/comments/lib/comment-panel-initial-data-actions";
import { createCommentPanelInteractions } from "@/features/comments/lib/comment-panel-interactions";
import { createCommentPanelLoadSubmitActions } from "@/features/comments/lib/comment-panel-load-submit-actions";
import { mountCommentPanel } from "@/features/comments/lib/comment-panel-mount";
import {
  type CommentEditDraftState,
  type CommentReplyDraftState,
} from "@/features/comments/lib/comment-panel-state";
import { createCommentPanelTargetActions } from "@/features/comments/lib/comment-panel-target-actions";
import { createCommentPanelUploadActions } from "@/features/comments/lib/comment-panel-upload-actions";
import {
  COMMENT_REACTION_OPTIONS,
  type CommentTargetOption,
  type CommentTargetType as TargetType,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { AppLocale } from "@/i18n/config";
import { getCommentsCopy } from "@/lib/comments-copy";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { page } from "$app/stores";
import CommentsPanelView from "./CommentsPanelView.svelte";

export let targetType: TargetType;
export let targetId: number | string | null = null;
export let sectionId: number | null = null;
export let showAllTargets = false;
export let initialData: CommentsInitialData | null = null;
export let targets: CommentTargetOption[] = [];
export let teacherId: number | null = null;

const reactionOptions = COMMENT_REACTION_OPTIONS;
let {
  _actionMenuId,
  _appliedInitialData,
  _body,
  _comments,
  _deleteTarget,
  _editAttachmentIds,
  _editDraft,
  _editIsAnonymous,
  _editingId,
  _editUploadedFiles,
  _editVisibility,
  _hiddenCount,
  _highlightedId,
  _isAnonymous,
  _isDragActive,
  _loading,
  _message,
  _pendingReactionKey,
  _postTargetKey,
  _reactionMenuId,
  _replyAttachmentIds,
  _replyDraft,
  _replyingId,
  _replyIsAnonymous,
  _replyUploadedFiles,
  _replyVisibility,
  _selectedAttachments,
  _submitting,
  _uploadedFiles,
  _uploading,
  _viewer,
  _visibility,
} = createCommentPanelDefaultState();
const _commentHashScroller = createCommentHashScroller({
  setHighlightedId: (value) => {
    _highlightedId = value;
  },
  waitForDom: tick,
});
const _scrollToHashComment = _commentHashScroller.scrollToHashComment;

$: _copy = getCommentsCopy(($page.data.locale ?? "zh-cn") as AppLocale);
$: _commentCopy = _copy.comments;
$: _uploadCopy = _copy.uploads;
$: _dateTimeFormatter = createShanghaiDateTimeFormatter(
  ($page.data.locale ?? "zh-cn") as AppLocale,
  {
    dateStyle: "medium",
    timeStyle: "short",
  },
);
$: _signInHref = commentPanelSignInHref($page.url.pathname, $page.url.search);
$: _resolvedTargets = resolveCommentTargets({
  copy: _commentCopy,
  sectionId,
  targetId,
  targets,
  targetType,
  teacherId,
});
$: if (
  _resolvedTargets[0] &&
  (!_postTargetKey ||
    !_resolvedTargets.some((target) => target.key === _postTargetKey))
) {
  _postTargetKey = _resolvedTargets[0].key;
}
$: _postTargetOptions = commentPostTargetOptions(_resolvedTargets);
$: _visibilityOptions = buildCommentVisibilityOptions(_commentCopy);

const { applyInitialData: _applyInitialData } =
  createCommentPanelInitialDataActions({
    getResolvedTargets: () => _resolvedTargets,
    getShowAllTargets: () => showAllTargets,
    setComments: (value) => {
      _comments = value;
    },
    setHiddenCount: (value) => {
      _hiddenCount = value;
    },
    setLoading: (value) => {
      _loading = value;
    },
    setViewer: (value) => {
      _viewer = value;
    },
  });

$: if (initialData && !_appliedInitialData && _resolvedTargets.length > 0) {
  _applyInitialData(initialData);
  _appliedInitialData = true;
}

onMount(() => {
  return mountCommentPanel({
    clearHashScroller: _commentHashScroller.clear,
    hasInitialData: Boolean(initialData),
    loadComments: _loadComments,
    scrollToHashComment: _scrollToHashComment,
    waitForDom: tick,
  });
});

const {
  commentTarget: _commentTarget,
  selectedPostTarget: _selectedPostTarget,
} = createCommentPanelTargetActions({
  getPostTargetKey: () => _postTargetKey,
  getResolvedTargets: () => _resolvedTargets,
});

const {
  applyReactionUpdate: _applyReactionUpdate,
  authorInitials: _authorInitials,
  authorName: _authorName,
  formatSize: _formatSize,
  formatTime: _formatTime,
  reactionEntry: _reactionEntry,
  reactionKey: _reactionKey,
  reactionLabel: _reactionLabel,
  reactionName: _reactionName,
  statusLabel: _statusLabel,
} = createCommentPanelDisplayActions({
  getCommentCopy: () => _commentCopy,
  getComments: () => _comments,
  getDateTimeFormatter: () => _dateTimeFormatter,
  setComments: (value) => {
    _comments = value;
  },
});

function _applyReplyDraftState(next: CommentReplyDraftState) {
  _replyDraft = next.draft;
  _replyingId = next.replyingId;
  _replyVisibility = next.visibility;
  _replyIsAnonymous = next.isAnonymous;
  _replyAttachmentIds = next.attachmentIds;
  _replyUploadedFiles = next.uploadedFiles;
}

const {
  cancelReply: _cancelReply,
  insertMarkdown: _insertMarkdown,
  removeAttachment: _removeAttachment,
  removeReplyAttachment: _removeReplyAttachment,
  replaceMarkdownToken: _replaceMarkdownToken,
  toggleReply: _toggleReply,
} = createCommentPanelDraftActions({
  applyReplyDraftState: _applyReplyDraftState,
  getBody: () => _body,
  getEditDraft: () => _editDraft,
  getReplyAttachmentIds: () => _replyAttachmentIds,
  getReplyDraft: () => _replyDraft,
  getReplyingId: () => _replyingId,
  getReplyUploadedFiles: () => _replyUploadedFiles,
  getSelectedAttachments: () => _selectedAttachments,
  getUploadedFiles: () => _uploadedFiles,
  setBody: (value) => {
    _body = value;
  },
  setEditDraft: (value) => {
    _editDraft = value;
  },
  setReplyAttachmentIds: (value) => {
    _replyAttachmentIds = value;
  },
  setReplyDraft: (value) => {
    _replyDraft = value;
  },
  setReplyUploadedFiles: (value) => {
    _replyUploadedFiles = value;
  },
  setSelectedAttachments: (value) => {
    _selectedAttachments = value;
  },
  setUploadedFiles: (value) => {
    _uploadedFiles = value;
  },
});

const { loadComments: _loadComments, submitComment: _submitComment } =
  createCommentPanelLoadSubmitActions({
    cancelReply: _cancelReply,
    getBody: () => _body,
    getCommentCopy: () => _commentCopy,
    getIsAnonymous: () => _isAnonymous,
    getReplyAttachmentIds: () => _replyAttachmentIds,
    getReplyIsAnonymous: () => _replyIsAnonymous,
    getReplyVisibility: () => _replyVisibility,
    getSelectedAttachments: () => _selectedAttachments,
    getShowAllTargets: () => showAllTargets,
    getSubmitting: () => _submitting,
    getTargetType: () => targetType,
    getTargets: () => _resolvedTargets,
    getVisibility: () => _visibility,
    scrollToHashComment: _scrollToHashComment,
    selectedPostTarget: _selectedPostTarget,
    setBody: (value) => {
      _body = value;
    },
    setComments: (value) => {
      _comments = value;
    },
    setHiddenCount: (value) => {
      _hiddenCount = value;
    },
    setLoading: (value) => {
      _loading = value;
    },
    setMessage: (value) => {
      _message = value;
    },
    setSelectedAttachments: (value) => {
      _selectedAttachments = value;
    },
    setSubmitting: (value) => {
      _submitting = value;
    },
    setUploadedFiles: (value) => {
      _uploadedFiles = value;
    },
    setViewer: (value) => {
      _viewer = value;
    },
  });

const { uploadFile: _uploadFile } = createCommentPanelUploadActions({
  getEditAttachmentIds: () => _editAttachmentIds,
  getEditUploadedFiles: () => _editUploadedFiles,
  getReplyAttachmentIds: () => _replyAttachmentIds,
  getReplyUploadedFiles: () => _replyUploadedFiles,
  getSelectedAttachments: () => _selectedAttachments,
  getUploadCopy: () => _uploadCopy,
  getUploadedFiles: () => _uploadedFiles,
  insertMarkdown: _insertMarkdown,
  replaceMarkdownToken: _replaceMarkdownToken,
  setEditAttachmentIds: (value) => {
    _editAttachmentIds = value;
  },
  setEditUploadedFiles: (value) => {
    _editUploadedFiles = value;
  },
  setMessage: (value) => {
    _message = value;
  },
  setReplyAttachmentIds: (value) => {
    _replyAttachmentIds = value;
  },
  setReplyUploadedFiles: (value) => {
    _replyUploadedFiles = value;
  },
  setSelectedAttachments: (value) => {
    _selectedAttachments = value;
  },
  setUploadedFiles: (value) => {
    _uploadedFiles = value;
  },
  setUploading: (value) => {
    _uploading = value;
  },
});

const {
  handleEditorDrop: _handleEditorDrop,
  handleSubmitShortcut: _handleSubmitShortcut,
} = createCommentPanelEditorEventActions({
  getViewer: () => _viewer,
  setDragActive: (value) => {
    _isDragActive = value;
  },
  submitComment: _submitComment,
  uploadFile: _uploadFile,
});

function _applyEditDraftState(next: CommentEditDraftState) {
  _editingId = next.editingId;
  _editDraft = next.draft;
  _editVisibility = next.visibility;
  _editIsAnonymous = next.isAnonymous;
  _editAttachmentIds = next.attachmentIds;
  _editUploadedFiles = next.uploadedFiles;
}

function _editAttachmentOptions(comment: CommentNode) {
  return commentEditAttachmentOptions(
    comment,
    _editUploadedFiles,
    _editAttachmentIds,
  );
}

const {
  cancelEdit: _cancelEdit,
  saveEdit: _saveEdit,
  startEdit: _startEdit,
} = createCommentPanelEditActions({
  applyEditDraftState: _applyEditDraftState,
  getCommentCopy: () => _commentCopy,
  getEditAttachmentIds: () => _editAttachmentIds,
  getEditDraft: () => _editDraft,
  getEditIsAnonymous: () => _editIsAnonymous,
  getEditVisibility: () => _editVisibility,
  loadComments: _loadComments,
  setActionMenuId: (value) => {
    _actionMenuId = value;
  },
  setMessage: (value) => {
    _message = value;
  },
});

const {
  closeDeleteDialog: _closeDeleteDialog,
  copyCommentLink: _copyCommentLink,
  deleteComment: _deleteComment,
  openDeleteDialog: _openDeleteDialog,
  react: _react,
} = createCommentPanelInteractions({
  applyReactionUpdate: _applyReactionUpdate,
  getCommentCopy: () => _commentCopy,
  getCurrentHref: () => location.href,
  getDeleteTarget: () => _deleteTarget,
  getPendingReactionKey: () => _pendingReactionKey,
  getViewer: () => _viewer,
  loadComments: _loadComments,
  setActionMenuId: (value) => {
    _actionMenuId = value;
  },
  setDeleteTarget: (value) => {
    _deleteTarget = value;
  },
  setMessage: (value) => {
    _message = value;
  },
  setPendingReactionKey: (value) => {
    _pendingReactionKey = value;
  },
  setReactionMenuId: (value) => {
    _reactionMenuId = value;
  },
});
</script>

<CommentsPanelView
  bind:actionMenuId={_actionMenuId}
  appliedInitialData={_appliedInitialData}
  authorInitials={_authorInitials}
  authorName={_authorName}
  bind:body={_body}
  cancelEdit={_cancelEdit}
  cancelReply={_cancelReply}
  closeDeleteDialog={_closeDeleteDialog}
  commentCopy={_commentCopy}
  commentTarget={_commentTarget}
  comments={_comments}
  copyCommentLink={_copyCommentLink}
  deleteComment={() => {
    void _deleteComment();
  }}
  deleteTarget={_deleteTarget}
  bind:editAttachmentIds={_editAttachmentIds}
  editAttachmentOptions={_editAttachmentOptions}
  bind:editDraft={_editDraft}
  bind:editingId={_editingId}
  bind:editIsAnonymous={_editIsAnonymous}
  bind:editVisibility={_editVisibility}
  formatSize={_formatSize}
  formatTime={_formatTime}
  handleEditorDrop={_handleEditorDrop}
  handleSubmitShortcut={_handleSubmitShortcut}
  hiddenCount={_hiddenCount}
  highlightedId={_highlightedId}
  bind:isAnonymous={_isAnonymous}
  bind:isDragActive={_isDragActive}
  loading={_loading}
  message={_message}
  openDeleteDialog={_openDeleteDialog}
  pendingReactionKey={_pendingReactionKey}
  bind:postTargetKey={_postTargetKey}
  postTargetOptions={_postTargetOptions}
  react={_react}
  reactionEntry={_reactionEntry}
  reactionKey={_reactionKey}
  reactionLabel={_reactionLabel}
  bind:reactionMenuId={_reactionMenuId}
  reactionName={_reactionName}
  {reactionOptions}
  removeAttachment={_removeAttachment}
  removeReplyAttachment={_removeReplyAttachment}
  bind:replyDraft={_replyDraft}
  replyingId={_replyingId}
  bind:replyIsAnonymous={_replyIsAnonymous}
  replyUploadedFiles={_replyUploadedFiles}
  bind:replyVisibility={_replyVisibility}
  saveEdit={_saveEdit}
  signInHref={_signInHref}
  startEdit={_startEdit}
  statusLabel={_statusLabel}
  submitComment={_submitComment}
  submitting={_submitting}
  toggleReply={_toggleReply}
  uploadCopy={_uploadCopy}
  uploadedFiles={_uploadedFiles}
  uploadFile={_uploadFile}
  uploading={_uploading}
  viewer={_viewer}
  bind:visibility={_visibility}
  visibilityOptions={_visibilityOptions}
/>
