<script lang="ts">
import SquarePen from "@lucide/svelte/icons/square-pen";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";
import ModerationStatusBadge from "./ModerationStatusBadge.svelte";

export let filterControls: AdminModerationFilterControls;
export let comments: AdminModerationComment[];
export let copy: AdminModerationCommentsCopy;
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let formatDate: (value: string | Date) => string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetHref: AdminModerationCommentFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<CollectionTableShell cards label={copy.content}>
  <Table.Root class="w-full min-w-[64rem]">
    <Table.Header>
      <TableControlsRow colspan={6}>{@render filterControls("search")}</TableControlsRow>
      <Table.Row>
        <Table.Head class="w-[34%]">{@render filterControls("content")}</Table.Head>
        <Table.Head class="w-[16%]">{@render filterControls("author")}</Table.Head>
        <Table.Head class="w-[20%]">{@render filterControls("target")}</Table.Head>
        <Table.Head class="w-[14%]">{@render filterControls("createdAt")}</Table.Head>
        <Table.Head class="w-[10%]">{@render filterControls("status")}</Table.Head>
        <Table.Head class="w-14 min-w-14">
          <span class="sr-only">{copy.actions}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each comments as comment}
        <Table.Row class="group">
          <Table.Cell data-label={copy.content}>
            <div class="grid min-w-0 gap-1">
              <TruncatedText
                class="text-sm font-medium"
                lines={2}
                preserveWhitespace
                text={comment.body}
              />
              <TruncatedText
                class="text-muted-foreground text-xs"
                text={comment.moderationNote ? `${copy.moderationNote}: ${comment.moderationNote}` : null}
              />
            </div>
          </Table.Cell>
          <Table.Cell data-label={copy.author} class="max-w-0">
            {@const author = commentAuthorLabel(comment)}
            <span class="block max-w-full truncate" title={author}>{author}</span>
          </Table.Cell>
          <Table.Cell data-label={copy.postedIn}>
            <a
              class="block min-w-0 max-w-full overflow-hidden hover:underline"
              href={targetHref(comment)}
              title={targetLabel(comment)}
            >
              <TruncatedText text={targetLabel(comment)} />
            </a>
          </Table.Cell>
          <Table.Cell data-label={copy.createdAt} class="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatDate(comment.createdAt)}
          </Table.Cell>
          <Table.Cell data-label={copy.status}>
            <ModerationStatusBadge
              label={statusLabel(comment.status)}
              status={comment.status}
            />
          </Table.Cell>
          <Table.Cell>
            <TableRowActions>
              <TableIconButton
                label={copy.manageComment}
                onclick={() => onManage(comment)}
              >
                <SquarePen />
              </TableIconButton>
            </TableRowActions>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row><Table.Cell colspan={6}><CollectionEmpty variant="compact" description={copy.noComments} /></Table.Cell></Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</CollectionTableShell>
