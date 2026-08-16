<script lang="ts">
import * as Table from "$lib/components/ui/table/index.js";
import AdminModerationCommentTableRow from "./AdminModerationCommentTableRow.svelte";
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

<div class="hidden min-w-0 xl:block">
  <Table.Root class="w-full">
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.content}</Table.Head>
        <Table.Head>{copy.author}</Table.Head>
        <Table.Head>{copy.postedIn}</Table.Head>
        <Table.Head class="text-right">{copy.createdAt}</Table.Head>
        <Table.Head class="text-center">{copy.status}</Table.Head>
        <Table.Head class="w-12 text-right">
          <span class="sr-only">{copy.actions}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each comments as comment}
        <AdminModerationCommentTableRow
          {comment}
          {commentAuthorLabel}
          {copy}
          {formatDate}
          {onManage}
          {statusLabel}
          {targetHref}
          {targetLabel}
        />
      {/each}
    </Table.Body>
  </Table.Root>
</div>
