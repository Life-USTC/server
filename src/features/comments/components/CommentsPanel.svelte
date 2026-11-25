<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import { onMount, tick } from "svelte";
import { signInHrefForPage } from "#lib/auth/auth-routing.js";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { commentEditAttachmentOptions } from "@/features/comments/lib/comment-panel-controller";
import {
  type CommentsInitialData,
  type CommentTargetLoadState,
  commentPostTargetOptions,
  resolveCommentTargets,
} from "@/features/comments/lib/comment-panel-data";
import { createCommentPanelDefaultState } from "@/features/comments/lib/comment-panel-default-state";
import { buildCommentVisibilityOptions } from "@/features/comments/lib/comment-panel-defaults";
import { createCommentPanelDraftActions } from "@/features/comments/lib/comment-panel-draft-actions";
import { createCommentPanelEditActions } from "@/features/comments/lib/comment-panel-edit-actions";
import { createCommentPanelEditorEventActions } from "@/features/comments/lib/comment-panel-editor-event-actions";
import { createCommentHashScroller } from "@/features/comments/lib/comment-panel-hash-scroll";
import { createCommentPanelInitialDataActions } from "@/features/comments/lib/comment-panel-initial-data-actions";
import { createCommentPanelInteractions } from "@/features/comments/lib/comment-panel-interactions";
import { createCommentPanelLoadSubmitActions } from "@/features/comments/lib/comment-panel-load-submit-actions";
import { mountCommentPanel } from "@/features/comments/lib/comment-panel-mount";
import { createCommentPanelTargetActions } from "@/features/comments/lib/comment-panel-target-actions";
import { createCommentPanelUploadActions } from "@/features/comments/lib/comment-panel-upload-actions";
import { commentUploadPendingForMode } from "@/features/comments/lib/comment-panel-upload-state";
import {
  type CommentTargetOption,
  nextCommentReactions,
  type CommentTargetType as TargetType,
  updateCommentTree,
} from "@/features/comments/lib/comment-ui";
import { getCommentsCopy } from "@/features/comments/lib/comments-copy";
import type { AppLocale } from "@/i18n/config";
import { campusTimestampFormatter } from "@/lib/time/shanghai-format";
import { page as routePage } from "$app/state";
import CommentDeleteDialog from "./CommentDeleteDialog.svelte";
import CommentReactionControls from "./CommentReactionControls.svelte";
import CommentReplyEditor from "./CommentReplyEditor.svelte";
import CommentsComposerSection from "./CommentsComposerSection.svelte";
import CommentsHiddenNotice from "./CommentsHiddenNotice.svelte";
import CommentsPanelSuspensionAlert from "./CommentsPanelSuspensionAlert.svelte";
import CommentsThreadSection from "./CommentsThreadSection.svelte";
import CommentThreadBody from "./CommentThreadBody.svelte";
import CommentThreadEditForm from "./CommentThreadEditForm.svelte";
import CommentThreadHeader from "./CommentThreadHeader.svelte";

interface Props {
  targetType: TargetType;
  targetId?: number | string | null;
  sectionId?: number | null;
  showAllTargets?: boolean;
  initialData?: CommentsInitialData | null;
  permalinkBaseHref?: string | null;
  targets?: CommentTargetOption[];
  teacherId?: number | null;
  youngId?: string | null;
  /** When set, composer primary action sits on the same row as this heading. */
  heading?: string | null;
  readOnlyReason?: string;
}

let {
  targetType,
  targetId = null,
  sectionId = null,
  showAllTargets = false,
  initialData = null,
  permalinkBaseHref = null,
  targets = [],
  teacherId = null,
  youngId = null,
  heading = null,
  readOnlyReason = undefined,
}: Props = $props();

const panel = $state(createCommentPanelDefaultState());

function set<K extends keyof typeof panel>(key: K) {
  return (value: (typeof panel)[K]) => {
    panel[key] = value;
  };
}

let _loadCommentForHash: (commentId: string) => Promise<void> = async () => {};
const _commentHashScroller = createCommentHashScroller({
  loadMissingComment: (commentId) => _loadCommentForHash(commentId),
  setHighlightedId: set("highlightedId"),
  waitForDom: tick,
});
const _scrollToHashComment = _commentHashScroller.scrollToHashComment;

let _copy = $derived(
  getCommentsCopy((routePage.data.locale ?? "zh-cn") as AppLocale),
);
let _commentCopy = $derived(_copy.comments);
let _uploadCopy = $derived(_copy.uploads);
let _dateTimeFormatter = $derived(
  campusTimestampFormatter((routePage.data.locale ?? "zh-cn") as AppLocale),
);
let _signInHref = $derived(signInHrefForPage(routePage.url));
let _resolvedTargets = $derived(
  resolveCommentTargets({
    copy: _commentCopy,
    permalinkBaseHref,
    sectionId,
    targetId,
    targets,
    targetType,
    teacherId,
    youngId,
  }),
);
function syncPostTarget() {
  if (
    _resolvedTargets[0] &&
    (!panel.postTargetKey ||
      !_resolvedTargets.some((target) => target.key === panel.postTargetKey))
  ) {
    panel.postTargetKey = _resolvedTargets[0].key;
  }
}
syncPostTarget();
$effect.pre(syncPostTarget);
let _postTargetOptions = $derived(commentPostTargetOptions(_resolvedTargets));
let _visibilityOptions = $derived(buildCommentVisibilityOptions(_commentCopy));
let _viewerResolved = $derived(
  panel.appliedInitialData ||
    panel.targetLoadStates.some((state) => state.loaded),
);

const { applyInitialData: _applyInitialData } =
  createCommentPanelInitialDataActions({
    getResolvedTargets: () => _resolvedTargets,
    getShowAllTargets: () => showAllTargets,
    setComments: set("comments"),
    setHiddenCount: set("hiddenCount"),
    setLoading: set("loading"),
    setTargetLoadStates: set("targetLoadStates"),
    setViewer: set("viewer"),
  });

function applyInitialComments() {
  if (initialData && !panel.appliedInitialData && _resolvedTargets.length > 0) {
    _applyInitialData(initialData);
    panel.appliedInitialData = true;
  }
}
applyInitialComments();
$effect.pre(applyInitialComments);

onMount(() => {
  return mountCommentPanel({
    clearHashScroller: _commentHashScroller.clear,
    hasInitialData: Boolean(initialData && initialData.complete !== false),
    loadComments: _loadComments,
    scrollToHashComment: _scrollToHashComment,
    waitForDom: tick,
  });
});

const {
  commentTarget: _commentTarget,
  selectedPostTarget: _selectedPostTarget,
} = createCommentPanelTargetActions({
  getPostTargetKey: () => panel.postTargetKey,
  getResolvedTargets: () => _resolvedTargets,
});

function formatTime(value: Date | string | null | undefined) {
  return value ? _dateTimeFormatter.format(new Date(value)) : "";
}

const {
  cancelReply: _cancelReply,
  insertMarkdown: _insertMarkdown,
  removeAttachment: _removeAttachment,
  removeReplyAttachment: _removeReplyAttachment,
  replaceMarkdownToken: _replaceMarkdownToken,
  toggleReply: _toggleReply,
} = createCommentPanelDraftActions(panel);

const {
  loadComments: _loadComments,
  loadCommentForHash: _loadCommentForHashImpl,
  loadMoreComments: _loadMoreComments,
  loadMoreReplies: _loadMoreReplies,
  loadTarget: _loadTarget,
  submitComment: _submitComment,
} = createCommentPanelLoadSubmitActions({
  cancelReply: _cancelReply,
  getBody: () => panel.body,
  getCommentCopy: () => _commentCopy,
  getComments: () => panel.comments,
  getIsAnonymous: () => panel.isAnonymous,
  getReplyAttachmentIds: () => panel.replyAttachmentIds,
  getReplyIsAnonymous: () => panel.replyIsAnonymous,
  getReplyVisibility: () => panel.replyVisibility,
  getSelectedAttachments: () => panel.selectedAttachments,
  getShowAllTargets: () => showAllTargets,
  getSubmitting: () => panel.submitting,
  getTargetLoadStates: () => panel.targetLoadStates,
  getTargetType: () => targetType,
  getTargets: () => _resolvedTargets,
  getVisibility: () => panel.visibility,
  hasPendingUploads: (mode) =>
    commentUploadPendingForMode(panel.uploadPending, mode),
  scrollToHashComment: _scrollToHashComment,
  selectedPostTarget: _selectedPostTarget,
  onSuccess: (mode) => {
    toast.success(
      mode === "comment" ? _commentCopy.postSuccess : _commentCopy.replySuccess,
    );
  },
  setBody: set("body"),
  setComments: set("comments"),
  setHiddenCount: set("hiddenCount"),
  setLoading: set("loading"),
  setLoadingReplyRootId: set("loadingReplyRootId"),
  setLoadingTargetKey: set("loadingTargetKey"),
  setMessage: set("message"),
  setMessageVariant: set("messageVariant"),
  setSelectedAttachments: set("selectedAttachments"),
  setSubmitting: set("submitting"),
  setTargetLoadStates: (value: CommentTargetLoadState[]) => {
    panel.targetLoadStates = value;
  },
  setUploadedFiles: set("uploadedFiles"),
  setViewer: set("viewer"),
});
_loadCommentForHash = _loadCommentForHashImpl;

const { uploadFile: _uploadFile } = createCommentPanelUploadActions({
  panel,
  getUploadCopy: () => _uploadCopy,
  insertMarkdown: _insertMarkdown,
  onSuccess: (filename) => {
    toast.success(
      _uploadCopy.toastUploadSuccessDescription.replace("{name}", filename),
    );
  },
  replaceMarkdownToken: _replaceMarkdownToken,
});

const {
  handleEditorDrop: _handleEditorDrop,
  handleSubmitShortcut: _handleSubmitShortcut,
} = createCommentPanelEditorEventActions({
  getViewer: () => panel.viewer,
  setDragActive: set("isDragActive"),
  submitComment: _submitComment,
  uploadFile: _uploadFile,
});

const {
  cancelEdit: _cancelEdit,
  saveEdit: _saveEdit,
  startEdit: _startEdit,
} = createCommentPanelEditActions({
  panel,
  getCommentCopy: () => _commentCopy,
  loadComments: _loadComments,
  onSuccess: () => {
    toast.success(_commentCopy.editSuccess);
  },
});

const {
  closeDeleteDialog: _closeDeleteDialog,
  copyCommentLink: _copyCommentLink,
  deleteComment: _deleteComment,
  openDeleteDialog: _openDeleteDialog,
  react: _react,
} = createCommentPanelInteractions({
  applyReactionUpdate(commentId, type, shouldRemove) {
    panel.comments = updateCommentTree(
      panel.comments,
      commentId,
      (comment) => ({
        ...comment,
        reactions: nextCommentReactions(comment.reactions, type, shouldRemove),
      }),
    );
  },
  getCommentCopy: () => _commentCopy,
  getCurrentHref: () => location.href,
  getDeleteTarget: () => panel.deleteTarget,
  getPendingReactionKey: () => panel.pendingReactionKey,
  getViewer: () => panel.viewer,
  loadComments: _loadComments,
  onCopySuccess: (message) => {
    toast.success(message);
  },
  onSuccess: (action) => {
    toast.success(
      action === "reaction"
        ? _commentCopy.reactionSuccess
        : _commentCopy.deleteSuccess,
    );
  },
  setActionMenuId: set("actionMenuId"),
  setDeleteTarget: set("deleteTarget"),
  setDeleting: set("deleting"),
  setMessage: set("message"),
  setMessageVariant: set("messageVariant"),
  setPendingReactionKey: set("pendingReactionKey"),
  setReactionMenuId: set("reactionMenuId"),
});

let _newUploading = $derived(
  commentUploadPendingForMode(panel.uploadPending, "new"),
);
let _replyUploading = $derived(
  commentUploadPendingForMode(panel.uploadPending, "reply"),
);
let _editUploading = $derived(
  commentUploadPendingForMode(panel.uploadPending, "edit"),
);
</script>


<section class="grid min-w-0 gap-4">
  {#if panel.message && !panel.deleteTarget}
    <Alert.Root variant={panel.messageVariant}>
      <Alert.Description>{panel.message}</Alert.Description>
      {#if !_viewerResolved}
        <div><Button variant="outline" size="sm" disabled={panel.loading} onclick={_loadComments}>{_commentCopy.retry}</Button></div>
      {/if}
    </Alert.Root>
  {/if}
  {#if panel.viewer.isSuspended}
    <CommentsPanelSuspensionAlert
      commentCopy={_commentCopy}
      {formatTime}
      viewer={panel.viewer}
    />
  {/if}

  <CommentsComposerSection
    viewerResolved={_viewerResolved}
    bind:body={panel.body}
    commentCopy={_commentCopy}
    heading={heading}
    {readOnlyReason}
    handleEditorDrop={_handleEditorDrop}
    handleSubmitShortcut={_handleSubmitShortcut}
    bind:isAnonymous={panel.isAnonymous}
    bind:isDragActive={panel.isDragActive}
    loading={panel.loading}
    bind:postTargetKey={panel.postTargetKey}
    postTargetOptions={_postTargetOptions}
    removeAttachment={_removeAttachment}
    signInHref={_signInHref}
    submitComment={_submitComment}
    submitting={panel.submitting}
    uploadCopy={_uploadCopy}
    uploadedFiles={panel.uploadedFiles}
    uploadFile={_uploadFile}
    uploading={_newUploading}
    viewer={panel.viewer}
    bind:visibility={panel.visibility}
    visibilityOptions={_visibilityOptions}
  />

  <CommentsThreadSection
    highlightedId={panel.highlightedId}
    commentCopy={{ ..._commentCopy, emptyDescription: readOnlyReason ? "" : (panel.viewer.isSuspended ? _commentCopy.suspendedMessage : panel.viewer.isAuthenticated ? _commentCopy.emptyAuthenticatedDescription : _commentCopy.emptyDescription) }}
    comments={panel.comments}
    loading={panel.loading}
    loadingReplyRootId={panel.loadingReplyRootId}
    loadingTargetKey={panel.loadingTargetKey}
    loadMoreComments={_loadMoreComments}
    loadMoreReplies={_loadMoreReplies}
    loadTarget={_loadTarget}
    targetLoadStates={panel.targetLoadStates}
  >
    {#snippet renderItem(comment)}
      <CommentThreadHeader
        bind:actionMenuId={panel.actionMenuId}
        {comment}
        commentCopy={_commentCopy}
        copyCommentLink={_copyCommentLink}
        {formatTime}
        openDeleteDialog={_openDeleteDialog}
        startEdit={_startEdit}
        toggleReply={_toggleReply}
      />

      {#if panel.editingId === comment.id}
        <CommentThreadEditForm
          cancelEdit={_cancelEdit}
          {comment}
          commentCopy={_commentCopy}
          bind:editAttachmentIds={panel.editAttachmentIds}
          files={commentEditAttachmentOptions(comment, panel.editUploadedFiles, panel.editAttachmentIds)}
          bind:editDraft={panel.editDraft}
          bind:editIsAnonymous={panel.editIsAnonymous}
          bind:editVisibility={panel.editVisibility}
          saveEdit={_saveEdit}
          uploadCopy={_uploadCopy}
          uploading={_editUploading}
          uploadFile={_uploadFile}
          visibilityOptions={_visibilityOptions}
        />
      {:else}
        <CommentThreadBody {comment} commentCopy={_commentCopy} />
      {/if}

      <div class="grid gap-4">
        <CommentReactionControls
          {comment}
          commentCopy={_commentCopy}
          pendingReactionKey={panel.pendingReactionKey}
          react={_react}
          bind:reactionMenuId={panel.reactionMenuId}
          viewer={panel.viewer}
        />

        {#if panel.replyingId === comment.id}
          <CommentReplyEditor
            cancelReply={_cancelReply}
            {comment}
            commentCopy={_commentCopy}
            commentTarget={_commentTarget}
            removeReplyAttachment={_removeReplyAttachment}
            bind:replyDraft={panel.replyDraft}
            bind:replyIsAnonymous={panel.replyIsAnonymous}
            replyUploadedFiles={panel.replyUploadedFiles}
            bind:replyVisibility={panel.replyVisibility}
            submitting={panel.submitting}
            submitComment={_submitComment}
            uploadCopy={_uploadCopy}
            uploading={_replyUploading}
            uploadFile={_uploadFile}
            visibilityOptions={_visibilityOptions}
            viewer={panel.viewer}
          />
        {/if}
      </div>
    {/snippet}
  </CommentsThreadSection>

  {#if panel.hiddenCount > 0 && !panel.viewer.isAuthenticated}
    <CommentsHiddenNotice
      commentCopy={_commentCopy}
      hiddenCount={panel.hiddenCount}
      signInHref={_signInHref}
    />
  {/if}
</section>

<CommentDeleteDialog
  close={_closeDeleteDialog}
  commentCopy={_commentCopy}
  deleting={panel.deleting}
  error={panel.message}
  deleteComment={() => {
    void _deleteComment();
  }}
  open={Boolean(panel.deleteTarget)}
/>
