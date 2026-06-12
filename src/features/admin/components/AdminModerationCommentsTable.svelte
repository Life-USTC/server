<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
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
export let statusBadgeClass: AdminModerationCommentStatusFormatter;
export let statusBorderClass: AdminModerationCommentStatusFormatter;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<Card.Root class="hidden md:block">
  <Card.Content class="p-0">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.content}</Table.Head>
          <Table.Head>{copy.author}</Table.Head>
          <Table.Head>{copy.postedIn}</Table.Head>
          <Table.Head>{copy.createdAt}</Table.Head>
          <Table.Head>{copy.status}</Table.Head>
          <Table.Head class="w-24 text-right">{copy.actions}</Table.Head>
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
            {statusBadgeClass}
            {statusBorderClass}
            {statusLabel}
            {targetHref}
            {targetLabel}
          />
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
