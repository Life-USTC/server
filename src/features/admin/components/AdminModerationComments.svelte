<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SquarePen from "@lucide/svelte/icons/square-pen";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";
import ModerationCollection from "./ModerationCollection.svelte";
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

{#snippet badge(comment: AdminModerationComment)}
  <ModerationStatusBadge label={statusLabel(comment.status)} status={comment.status} />
{/snippet}

<section class="grid grid-cols-[minmax(0,1fr)] gap-3">
  <ModerationCollection
    {filterControls}
    items={comments}
    label={copy.content}
    emptyDescription={copy.noComments}
    mobileTestId="admin-moderation-mobile-list"
    fields={["search", "content", "author", "target", "createdAt", "status"]}
  >
    {#snippet card(comment: AdminModerationComment)}
      <Item.Content class="min-w-0">
        <Item.Title class="line-clamp-3 whitespace-pre-wrap">{comment.body}</Item.Title>
        <Item.Description>{targetLabel(comment)}</Item.Description>
        <Item.Description>
          {commentAuthorLabel(comment)} · {formatDate(comment.createdAt)}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="shrink-0 flex-wrap self-start">
        {@render badge(comment)}
        <Button
          aria-label={copy.manageComment}
          onclick={() => onManage(comment)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {copy.manageComment}
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </Item.Actions>
    {/snippet}
    {#snippet desktop(emptyState)}
      <Table.Root class="w-full min-w-[64rem]">
        <Table.Header>
          <TableControlsRow colspan={6}>{@render filterControls("search", "desktop")}</TableControlsRow>
          <Table.Row>
            <Table.Head class="w-[34%]">{@render filterControls("content", "desktop")}</Table.Head>
            <Table.Head class="w-[16%]">{@render filterControls("author", "desktop")}</Table.Head>
            <Table.Head class="w-[20%]">{@render filterControls("target", "desktop")}</Table.Head>
            <Table.Head class="w-[14%]">{@render filterControls("createdAt", "desktop")}</Table.Head>
            <Table.Head class="w-[10%]">{@render filterControls("status", "desktop")}</Table.Head>
            <Table.Head class="w-14 min-w-14">
              <span class="sr-only">{copy.actions}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each comments as comment}
            <Table.Row class="group">
              <Table.Cell>
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
              <Table.Cell class="max-w-0">
                {@const author = commentAuthorLabel(comment)}
                <span class="block max-w-full truncate" title={author}>{author}</span>
              </Table.Cell>
              <Table.Cell>
                <a
                  class="block min-w-0 max-w-full overflow-hidden hover:underline"
                  href={targetHref(comment)}
                  title={targetLabel(comment)}
                >
                  <TruncatedText text={targetLabel(comment)} />
                </a>
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
                {formatDate(comment.createdAt)}
              </Table.Cell>
              <Table.Cell class="text-left">
                {@render badge(comment)}
              </Table.Cell>
              <Table.Cell class="w-14 min-w-14 text-left">
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
            <Table.Row><Table.Cell colspan={6}>{@render emptyState()}</Table.Cell></Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/snippet}
  </ModerationCollection>
</section>
