<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import AdminModerationCommentTableRow from "./AdminModerationCommentTableRow.svelte";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";

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

<div class="min-w-0">
  <CollectionTableShell label={copy.content}>
    <Table.Root class="w-full min-w-[64rem]">
      <Table.Header>
        <TableControlsRow colspan={6}>{@render filterControls("search", "desktop")}</TableControlsRow>
        <Table.Row>
          <Table.Head class="w-[34%]">{@render filterControls("content", "desktop")}</Table.Head>
          <Table.Head class="w-[16%]">{@render filterControls("author", "desktop")}</Table.Head>
          <Table.Head class="w-[20%]">{@render filterControls("target", "desktop")}</Table.Head>
          <Table.Head class="w-[14%] text-left">{@render filterControls("createdAt", "desktop")}</Table.Head>
          <Table.Head class="w-[10%] text-left">{@render filterControls("status", "desktop")}</Table.Head>
          <Table.Head class="w-14 min-w-14 text-left">
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
        {:else}
          <Table.Row><Table.Cell colspan={6}><CollectionEmpty variant="compact" description={copy.noComments} /></Table.Cell></Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </CollectionTableShell>
</div>
