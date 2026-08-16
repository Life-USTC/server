<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
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

<Table.Row class="group">
  <Table.Cell>
    <div class="grid min-w-0 gap-1">
      <TruncatedText
        class="text-sm"
        lines={2}
        preserveWhitespace
        text={comment.body}
      />
      {#if comment.moderationNote}
        <TruncatedText
          class="text-muted-foreground text-xs"
          text={`${copy.moderationNote}: ${comment.moderationNote}`}
        />
      {/if}
    </div>
  </Table.Cell>
  <Table.Cell>
    {commentAuthorLabel(comment)}
  </Table.Cell>
  <Table.Cell>
    <a
      class="block min-w-0 overflow-hidden hover:underline"
      href={targetHref(comment)}
    >
      <TruncatedText text={targetLabel(comment)} />
    </a>
  </Table.Cell>
  <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
    {formatDate(comment.createdAt)}
  </Table.Cell>
  <Table.Cell class="text-center">
    <ModerationStatusBadge
      label={statusLabel(comment.status)}
      status={comment.status}
    />
  </Table.Cell>
  <Table.Cell class="w-12 text-right">
    <DashboardTableRowActions class="justify-end">
      <DashboardTableIconButton
        label={copy.manageComment}
        onclick={() => {
          onManage(comment);
        }}
      >
        <SquarePen />
      </DashboardTableIconButton>
    </DashboardTableRowActions>
  </Table.Cell>
</Table.Row>
