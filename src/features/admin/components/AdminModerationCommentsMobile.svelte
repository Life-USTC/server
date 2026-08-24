<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  AdminModerationComment,
  AdminModerationCommentFormatter,
  AdminModerationCommentStatusFormatter,
} from "./admin-moderation-comment-types";
import ModerationStatusBadge from "./ModerationStatusBadge.svelte";

export let comments: AdminModerationComment[];
export let commentAuthorLabel: AdminModerationCommentFormatter;
export let formatDate: (value: string | Date) => string;
export let manageLabel: string;
export let onManage: (comment: AdminModerationComment) => void;
export let statusLabel: AdminModerationCommentStatusFormatter;
export let targetLabel: AdminModerationCommentFormatter;
</script>

<Item.Group class="xl:hidden gap-0 border-y" data-testid="admin-moderation-mobile-list" role="list">
  {#each comments as comment, index (comment.id)}
    <Item.Root class="items-start px-1 py-3" role="listitem">
      <Item.Content class="min-w-0">
        <Item.Title>{targetLabel(comment)}</Item.Title>
        <Item.Description>
          {commentAuthorLabel(comment)} · {formatDate(comment.createdAt)}
        </Item.Description>
        <Item.Description class="line-clamp-3 whitespace-pre-wrap">
          {comment.body}
        </Item.Description>
      </Item.Content>
      <Item.Actions class="shrink-0 self-start">
        <ModerationStatusBadge
          label={statusLabel(comment.status)}
          status={comment.status}
        />
        <Button
          aria-label={manageLabel}
          onclick={() => onManage(comment)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {manageLabel}
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </Item.Actions>
    </Item.Root>
    {#if index < comments.length - 1}<Item.Separator class="my-0" />{/if}
  {/each}
</Item.Group>
