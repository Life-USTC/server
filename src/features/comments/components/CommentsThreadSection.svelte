<script lang="ts">
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import CommentsThreadList from "./CommentsThreadList.svelte";
import type {
  CommentThreadProps,
  CommentUploadOption,
} from "./comment-component-types";

export let actionMenuId: string | null;
export let authorInitials: CommentThreadProps["authorInitials"];
export let authorName: CommentThreadProps["authorName"];
export let cancelEdit: CommentThreadProps["cancelEdit"];
export let cancelReply: CommentThreadProps["cancelReply"];
export let commentCopy: CommentThreadProps["commentCopy"];
export let commentTarget: CommentThreadProps["commentTarget"];
export let comments: CommentNodeWithContext[];
export let copyCommentLink: CommentThreadProps["copyCommentLink"];
export let editAttachmentIds: string[];
export let editAttachmentOptions: CommentThreadProps["editAttachmentOptions"];
export let editDraft: string;
export let editingId: string | null;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let formatSize: CommentThreadProps["formatSize"];
export let formatTime: CommentThreadProps["formatTime"];
export let highlightedId: string | null;
export let loading: boolean;
export let openDeleteDialog: CommentThreadProps["openDeleteDialog"];
export let pendingReactionKey: string | null;
export let react: CommentThreadProps["react"];
export let reactionEntry: CommentThreadProps["reactionEntry"];
export let reactionKey: CommentThreadProps["reactionKey"];
export let reactionLabel: CommentThreadProps["reactionLabel"];
export let reactionMenuId: string | null;
export let reactionName: CommentThreadProps["reactionName"];
export let reactionOptions: CommentThreadProps["reactionOptions"];
export let removeReplyAttachment: CommentThreadProps["removeReplyAttachment"];
export let replyDraft: string;
export let replyingId: string | null;
export let replyIsAnonymous: boolean;
export let replyUploadedFiles: CommentUploadOption[];
export let replyVisibility: string;
export let saveEdit: CommentThreadProps["saveEdit"];
export let startEdit: CommentThreadProps["startEdit"];
export let statusLabel: CommentThreadProps["statusLabel"];
export let submitting: boolean;
export let submitComment: CommentThreadProps["submitComment"];
export let toggleReply: CommentThreadProps["toggleReply"];
export let uploadCopy: CommentThreadProps["uploadCopy"];
export let uploadFile: CommentThreadProps["uploadFile"];
export let uploading: boolean;
export let viewer: ViewerContext;
export let visibilityOptions: CommentThreadProps["visibilityOptions"];
</script>

{#if loading}
  <div class="grid gap-3">
    <Skeleton class="h-24 w-full" />
    <Skeleton class="h-24 w-full" />
  </div>
{:else if comments.length === 0}
  <Alert>{commentCopy.emptyTitle}</Alert>
{:else}
  <CommentsThreadList
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
    {uploading}
    {uploadFile}
    {viewer}
    {visibilityOptions}
  />
{/if}
