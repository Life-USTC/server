<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
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

<section class="grid gap-3">
  {#if comments.length > 0}
    <AdminModerationCommentsMobile
      {commentAuthorLabel}
      {comments}
      {formatDate}
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
    <Empty.Root class="min-h-24">
      <Empty.Header>
        <Empty.Description>{copy.noComments}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</section>
