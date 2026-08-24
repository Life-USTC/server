<script lang="ts">
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import AdminModerationCommentsMobile from "./AdminModerationCommentsMobile.svelte";
import AdminModerationCommentsTable from "./AdminModerationCommentsTable.svelte";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";

export let comments: AdminModerationComment[];
export let copy: AdminModerationCommentsCopy;
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let formatDate: (value: string | Date) => string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<section class="grid grid-cols-[minmax(0,1fr)] gap-3">
  {#if comments.length > 0}
    <AdminModerationCommentsMobile
      {commentAuthorLabel}
      {comments}
      {formatDate}
      manageLabel={copy.manageComment}
      {onManage}
      {statusLabel}
      {targetLabel}
    />
    <AdminModerationCommentsTable
      {commentAuthorLabel}
      {comments}
      {copy}
      {formatDate}
      {onManage}
      {statusLabel}
      {targetHref}
      {targetLabel}
    />
  {:else}
    <SoftEmptyMessage message={copy.noComments} />
  {/if}
</section>
