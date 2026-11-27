<script lang="ts">
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import AdminEditAction from "./AdminEditAction.svelte";
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
    tableClass="w-full min-w-[64rem]"
    actionsLabel={copy.actions}
    columns={[
      ["content", 34],
      ["author", 16],
      ["target", 20],
      ["createdAt", 14],
      ["status", 10],
    ]}
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
        <AdminEditAction layout="card" label={copy.manageComment} onclick={() => onManage(comment)} />
      </Item.Actions>
    {/snippet}
    {#snippet cells(comment: AdminModerationComment)}
      {@const author = commentAuthorLabel(comment)}
      <td>
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
      </td>
      <td class="max-w-0">
        <span class="block max-w-full truncate" title={author}>{author}</span>
      </td>
      <td>
        <a
          class="block min-w-0 max-w-full overflow-hidden hover:underline"
          href={targetHref(comment)}
          title={targetLabel(comment)}
        >
          <TruncatedText text={targetLabel(comment)} />
        </a>
      </td>
      <td class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
        {formatDate(comment.createdAt)}
      </td>
      <td class="text-left">
        {@render badge(comment)}
      </td>
      <td class="w-14 min-w-14 text-left">
        <AdminEditAction layout="table" label={copy.manageComment} onclick={() => onManage(comment)} />
      </td>
    {/snippet}
  </ModerationCollection>
</section>
