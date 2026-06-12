<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
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
export let statusBadgeClass: AdminModerationCommentStatusFormatter;
export let statusBorderClass: AdminModerationCommentStatusFormatter;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<section class="grid gap-3">
  {#if comments.length > 0}
    <AdminModerationCommentsMobile
      {commentAuthorLabel}
      {comments}
      {formatDate}
      {onManage}
      {statusBadgeClass}
      {statusBorderClass}
      {statusLabel}
      {targetLabel}
    />
    <AdminModerationCommentsTable
      {commentAuthorLabel}
      {comments}
      {copy}
      {formatDate}
      {onManage}
      {statusBadgeClass}
      {statusBorderClass}
      {statusLabel}
      {targetHref}
      {targetLabel}
    />
  {:else}
    <Alert>{copy.noComments}</Alert>
  {/if}
</section>
