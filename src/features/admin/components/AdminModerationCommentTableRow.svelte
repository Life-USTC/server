<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentRowCopy,
  AdminModerationCommentStatusFormatter,
} from "./admin-moderation-comment-types";

export let comment: AdminModerationComment;
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let copy: AdminModerationCommentRowCopy;
export let formatDate: (value: string | Date) => string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusBadgeClass: AdminModerationCommentStatusFormatter;
export let statusBorderClass: AdminModerationCommentStatusFormatter;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<Table.Row
  class={`cursor-pointer border-l-4 ${statusBorderClass(comment.status)}`}
  onclick={() => onManage(comment)}
>
  <Table.Cell class="max-w-md">
    <p class="line-clamp-2 whitespace-pre-wrap text-sm">{comment.body}</p>
    {#if comment.moderationNote}
      <p class="mt-1 line-clamp-1 text-base-content/50 text-xs">
        {copy.moderationNote}: {comment.moderationNote}
      </p>
    {/if}
  </Table.Cell>
  <Table.Cell class="font-medium">
    {commentAuthorLabel(comment)}
  </Table.Cell>
  <Table.Cell class="max-w-sm text-sm">
    <a
      class="hover:underline"
      href={targetHref(comment)}
      onclick={(event) => event.stopPropagation()}
    >
      {targetLabel(comment)}
    </a>
  </Table.Cell>
  <Table.Cell class="text-base-content/60 text-xs">
    {formatDate(comment.createdAt)}
  </Table.Cell>
  <Table.Cell>
    <Badge class={statusBadgeClass(comment.status)}>
      {statusLabel(comment.status)}
    </Badge>
  </Table.Cell>
  <Table.Cell class="text-right">
    <Button
      size="sm"
      type="button"
      variant="outline"
      onclick={(event: MouseEvent) => {
        event.stopPropagation();
        onManage(comment);
      }}
    >
      {copy.manageComment}
    </Button>
  </Table.Cell>
</Table.Row>
