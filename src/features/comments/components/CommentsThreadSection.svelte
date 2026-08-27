<script lang="ts">
import type { CommentTargetLoadState } from "@/features/comments/lib/comment-panel-data";
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
export let editUploading: boolean;
export let editingId: string | null;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let formatSize: CommentThreadProps["formatSize"];
export let formatTime: CommentThreadProps["formatTime"];
export let highlightedId: string | null;
export let loading: boolean;
export let loadingReplyRootId: string | null;
export let loadingTargetKey: string | null;
export let loadMoreComments: (targetKey: string) => void;
export let loadMoreReplies: (rootId: string) => void;
export let loadTarget: (targetKey: string) => void;
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
export let replyUploading: boolean;
export let replyingId: string | null;
export let replyIsAnonymous: boolean;
export let replyUploadedFiles: CommentUploadOption[];
export let replyVisibility: string;
export let saveEdit: CommentThreadProps["saveEdit"];
export let startEdit: CommentThreadProps["startEdit"];
export let statusLabel: CommentThreadProps["statusLabel"];
export let submitting: boolean;
export let submitComment: CommentThreadProps["submitComment"];
export let targetLoadStates: CommentTargetLoadState[];
export let toggleReply: CommentThreadProps["toggleReply"];
export let uploadCopy: CommentThreadProps["uploadCopy"];
export let uploadFile: CommentThreadProps["uploadFile"];
export let viewer: ViewerContext;
export let visibilityOptions: CommentThreadProps["visibilityOptions"];

function canLoadTarget(state: CommentTargetLoadState) {
  return Boolean(
    state.target.type !== "section-teacher" || state.target.teacherId,
  );
}

function hasTargetContinuation(state: CommentTargetLoadState) {
  return (
    canLoadTarget(state) &&
    ((!state.loaded && state.page === 0) ||
      (state.loaded && state.page < state.totalPages))
  );
}
</script>

{#if loading}
  <div class="grid gap-3">
    <Skeleton class="h-24 w-full" />
    <Skeleton class="h-24 w-full" />
  </div>
{:else}
  {#if targetLoadStates.some(hasTargetContinuation)}
    <div class="mb-4 flex flex-wrap gap-2" data-testid="comment-target-load-controls">
      {#each targetLoadStates as state}
        {#if !state.loaded && canLoadTarget(state)}
          <Button
            disabled={loadingTargetKey !== null}
            size="sm"
            type="button"
            variant="outline"
            onclick={() => loadTarget(state.target.key)}
          >
            {state.target.label}: {commentCopy.loadTarget}
          </Button>
        {:else if state.loaded && state.page < state.totalPages}
          <Button
            disabled={loadingTargetKey !== null}
            size="sm"
            type="button"
            variant="outline"
            onclick={() => loadMoreComments(state.target.key)}
          >
            {state.target.label}: {commentCopy.loadMoreComments}
          </Button>
        {/if}
      {/each}
    </div>
  {/if}

  {#if comments.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{commentCopy.emptyTitle}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
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
      {editUploading}
      bind:editingId
      bind:editIsAnonymous
      bind:editVisibility
      {formatSize}
      {formatTime}
      {highlightedId}
      {loadingReplyRootId}
      {loadMoreReplies}
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
      {replyUploading}
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
      {viewer}
      {visibilityOptions}
    />
  {/if}
{/if}
