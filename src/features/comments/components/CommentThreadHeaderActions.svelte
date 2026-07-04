<script lang="ts">
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let actionMenuId: string | null;
export let comment: CommentNodeWithContext;
export let commentCopy: CommentsCopy;
export let copyCommentLink: (comment: CommentNode) => void;
export let openDeleteDialog: (comment: CommentNode) => void;
export let startEdit: (comment: CommentNode) => void;
export let toggleReply: (comment: CommentNode) => void;
</script>

<div class="flex flex-wrap items-center gap-1">
  {#if comment.canReply}
    <Button
      size="sm"
      type="button"
      variant="ghost"
      onclick={() => {
        toggleReply(comment);
      }}
    >
      {commentCopy.replyAction}
    </Button>
  {/if}
  {#if comment.canEdit}
    <Button size="sm" type="button" variant="ghost" onclick={() => startEdit(comment)}>
      {commentCopy.editAction}
    </Button>
  {/if}
  <div class="relative">
    <DropdownMenu.Root
      open={actionMenuId === comment.id}
      onOpenChange={(open) => {
        actionMenuId = open ? comment.id : null;
      }}
    >
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-label={commentCopy.moreActions}
            size="sm"
            variant="ghost"
          >
            {commentCopy.moreActions}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" preventScroll={false}>
        <DropdownMenu.Group>
          <DropdownMenu.Item onSelect={() => copyCommentLink(comment)}>
            {commentCopy.copyLinkAction}
          </DropdownMenu.Item>
          {#if comment.canDelete}
            <DropdownMenu.Item
              onSelect={() => openDeleteDialog(comment)}
              variant="destructive"
            >
              {commentCopy.deleteAction}
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>
