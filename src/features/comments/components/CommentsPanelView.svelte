<script lang="ts">
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Alert } from "$lib/components/ui/alert/index.js";
import CommentDeleteDialog from "./CommentDeleteDialog.svelte";
import CommentsComposerSection from "./CommentsComposerSection.svelte";
import CommentsHiddenNotice from "./CommentsHiddenNotice.svelte";
import CommentsPanelSuspensionAlert from "./CommentsPanelSuspensionAlert.svelte";
import CommentsThreadSection from "./CommentsThreadSection.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentThreadProps,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let actionMenuId: string | null;
export let appliedInitialData: boolean;
export let authorInitials: CommentThreadProps["authorInitials"];
export let authorName: CommentThreadProps["authorName"];
export let body: string;
export let cancelEdit: CommentThreadProps["cancelEdit"];
export let cancelReply: CommentThreadProps["cancelReply"];
export let closeDeleteDialog: () => void;
export let commentCopy: CommentsCopy;
export let commentTarget: CommentThreadProps["commentTarget"];
export let comments: CommentNodeWithContext[];
export let copyCommentLink: CommentThreadProps["copyCommentLink"];
export let deleteComment: () => void;
export let deleteTarget: CommentNode | null;
export let editAttachmentIds: string[];
export let editAttachmentOptions: CommentThreadProps["editAttachmentOptions"];
export let editDraft: string;
export let editingId: string | null;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let formatSize: CommentThreadProps["formatSize"];
export let formatTime: CommentThreadProps["formatTime"];
export let handleEditorDrop: (event: DragEvent) => void;
export let handleSubmitShortcut: (event: KeyboardEvent) => void;
export let hiddenCount: number;
export let highlightedId: string | null;
export let isAnonymous: boolean;
export let isDragActive: boolean;
export let loading: boolean;
export let message: string;
export let openDeleteDialog: CommentThreadProps["openDeleteDialog"];
export let pendingReactionKey: string | null;
export let postTargetKey: string;
export let postTargetOptions: CommentSelectOption[];
export let react: CommentThreadProps["react"];
export let reactionEntry: CommentThreadProps["reactionEntry"];
export let reactionKey: CommentThreadProps["reactionKey"];
export let reactionLabel: CommentThreadProps["reactionLabel"];
export let reactionMenuId: string | null;
export let reactionName: CommentThreadProps["reactionName"];
export let reactionOptions: CommentThreadProps["reactionOptions"];
export let removeAttachment: (uploadId: string) => void;
export let removeReplyAttachment: CommentThreadProps["removeReplyAttachment"];
export let replyDraft: string;
export let replyingId: string | null;
export let replyIsAnonymous: boolean;
export let replyUploadedFiles: CommentUploadOption[];
export let replyVisibility: string;
export let saveEdit: CommentThreadProps["saveEdit"];
export let signInHref: string;
export let startEdit: CommentThreadProps["startEdit"];
export let statusLabel: CommentThreadProps["statusLabel"];
export let submitComment: CommentThreadProps["submitComment"];
export let submitting: boolean;
export let toggleReply: CommentThreadProps["toggleReply"];
export let uploadCopy: UploadsCopy;
export let uploadedFiles: CommentUploadOption[];
export let uploadFile: CommentThreadProps["uploadFile"];
export let uploading: boolean;
export let viewer: ViewerContext;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];
</script>

<section class="grid gap-4">
  {#if message}<Alert variant="info">{message}</Alert>{/if}
  {#if viewer.isSuspended}
    <CommentsPanelSuspensionAlert {commentCopy} {formatTime} {viewer} />
  {/if}

  <CommentsComposerSection
    {appliedInitialData}
    bind:body
    {commentCopy}
    {handleEditorDrop}
    {handleSubmitShortcut}
    bind:isAnonymous
    bind:isDragActive
    {loading}
    bind:postTargetKey
    {postTargetOptions}
    {removeAttachment}
    {signInHref}
    {submitComment}
    {submitting}
    {uploadCopy}
    {uploadedFiles}
    {uploadFile}
    {uploading}
    {viewer}
    bind:visibility
    {visibilityOptions}
  />

  <CommentsThreadSection
    bind:actionMenuId
    {authorInitials}
    {authorName}
    {cancelEdit}
    {cancelReply}
    {commentCopy}
    {commentTarget}
    {comments}
    {copyCommentLink}
    bind:editAttachmentIds
    {editAttachmentOptions}
    bind:editDraft
    bind:editingId
    bind:editIsAnonymous
    bind:editVisibility
    {formatSize}
    {formatTime}
    {highlightedId}
    {loading}
    {openDeleteDialog}
    {pendingReactionKey}
    {react}
    {reactionEntry}
    {reactionKey}
    {reactionLabel}
    bind:reactionMenuId
    {reactionName}
    {reactionOptions}
    {removeReplyAttachment}
    bind:replyDraft
    {replyingId}
    bind:replyIsAnonymous
    {replyUploadedFiles}
    bind:replyVisibility
    {saveEdit}
    {startEdit}
    {statusLabel}
    {submitting}
    {submitComment}
    {toggleReply}
    {uploadCopy}
    {uploadFile}
    {uploading}
    {viewer}
    {visibilityOptions}
  />

  {#if hiddenCount > 0 && !viewer.isAuthenticated}
    <CommentsHiddenNotice {commentCopy} {hiddenCount} {signInHref} />
  {/if}
</section>

<CommentDeleteDialog
  close={closeDeleteDialog}
  {commentCopy}
  {deleteComment}
  open={Boolean(deleteTarget)}
/>
