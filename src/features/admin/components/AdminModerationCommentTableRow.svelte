<script lang="ts">
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { cn } from "$lib/utils.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentRowCopy,
  AdminModerationCommentStatusFormatter,
} from "./admin-moderation-comment-types";
import ModerationStatusBadge from "./ModerationStatusBadge.svelte";

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
    <TruncatedText
      class="text-sm"
      lines={2}
      preserveWhitespace
      text={comment.body}
    />
    <TruncatedText
      class="mt-1 text-muted-foreground text-xs"
      text={comment.moderationNote
        ? `${copy.moderationNote}: ${comment.moderationNote}`
        : null}
    />
  </Table.Cell>
  <Table.Cell class="max-w-48">
    <TruncatedText text={commentAuthorLabel(comment)} />
  </Table.Cell>
  <Table.Cell class="max-w-sm">
    <a
      class="block min-w-0 overflow-hidden hover:underline"
      href={targetHref(comment)}
    >
      <TruncatedText text={targetLabel(comment)} />
    </a>
  </Table.Cell>
  <Table.Cell>
    {formatDate(comment.createdAt)}
  </Table.Cell>
  <Table.Cell>
    <ModerationStatusBadge
      label={statusLabel(comment.status)}
      status={comment.status}
    />
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
