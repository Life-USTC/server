<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { cn } from "$lib/utils.js";
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
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<Table.Row
  class={cn(
    "border-l-4",
    comment.status === "active"
      ? "border-l-success"
      : comment.status === "deleted"
        ? "border-l-destructive"
        : "border-l-warning",
  )}
>
  <Table.Cell class="max-w-md">
    <p class="line-clamp-2 whitespace-pre-wrap text-sm">{comment.body}</p>
    {#if comment.moderationNote}
      <p class="mt-1 line-clamp-1 text-muted-foreground text-xs">
        {copy.moderationNote}: {comment.moderationNote}
      </p>
    {/if}
  </Table.Cell>
  <Table.Cell>
    {commentAuthorLabel(comment)}
  </Table.Cell>
  <Table.Cell class="max-w-sm">
    <a
      class="hover:underline"
      href={targetHref(comment)}
    >
      {targetLabel(comment)}
    </a>
  </Table.Cell>
  <Table.Cell>
    {formatDate(comment.createdAt)}
  </Table.Cell>
  <Table.Cell>
    <Badge variant={comment.status === "deleted" ? "destructive" : "outline"}>
      {statusLabel(comment.status)}
    </Badge>
  </Table.Cell>
  <Table.Cell class="text-right">
    <Button
      size="sm"
      type="button"
      variant="outline"
      onclick={() => {
        onManage(comment);
      }}
    >
      {copy.manageComment}
    </Button>
  </Table.Cell>
</Table.Row>
