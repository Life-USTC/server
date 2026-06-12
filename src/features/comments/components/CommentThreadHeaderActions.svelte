<script lang="ts">
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
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
    <Button
      aria-expanded={actionMenuId === comment.id}
      aria-haspopup="menu"
      aria-label={commentCopy.moreActions}
      onclick={() => (actionMenuId = actionMenuId === comment.id ? null : comment.id)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {commentCopy.moreActions}
    </Button>
    {#if actionMenuId === comment.id}
      <Menu.Root align="right">
        <Menu.Item onclick={() => copyCommentLink(comment)}>
          {commentCopy.copyLinkAction}
        </Menu.Item>
        {#if comment.isAuthor || comment.canModerate}
          <Menu.Item destructive onclick={() => openDeleteDialog(comment)}>
            {commentCopy.deleteAction}
          </Menu.Item>
        {/if}
        <Menu.Item class="cursor-not-allowed opacity-60" disabled>
          {commentCopy.reportAction}
        </Menu.Item>
      </Menu.Root>
    {/if}
  </div>
</div>
