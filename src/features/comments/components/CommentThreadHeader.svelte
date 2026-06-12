<script lang="ts">
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import CommentThreadHeaderActions from "./CommentThreadHeaderActions.svelte";
import type { CommentsCopy } from "./comment-component-types";

export let actionMenuId: string | null;
export let authorInitials: (comment: CommentNode) => string;
export let authorName: (comment: CommentNode) => string;
export let comment: CommentNodeWithContext;
export let commentCopy: CommentsCopy;
export let copyCommentLink: (comment: CommentNode) => void;
export let formatTime: (value: string) => string;
export let openDeleteDialog: (comment: CommentNode) => void;
export let startEdit: (comment: CommentNode) => void;
export let statusLabel: (status: string) => string;
export let toggleReply: (comment: CommentNode) => void;
</script>

<div class="flex flex-wrap items-start justify-between gap-3">
  <div class="flex min-w-0 items-start gap-3">
    <Avatar.Root>
      {#if !comment.authorHidden && comment.author?.image}
        <Avatar.Image src={comment.author.image} alt={authorName(comment)} />
      {:else}
        <Avatar.Fallback>{authorInitials(comment)}</Avatar.Fallback>
      {/if}
    </Avatar.Root>
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-semibold text-sm">{authorName(comment)}</h3>
        {#if comment.author?.isUstcVerified}<Badge variant="secondary">{commentCopy.ustcVerified}</Badge>{/if}
        {#if comment.isAuthor && comment.isAnonymous}<Badge variant="outline">{commentCopy.anonymousBadge}</Badge>{/if}
        {#if comment.visibility === "logged_in_only"}<Badge variant="outline">{commentCopy.visibilityLoggedIn}</Badge>{/if}
        {#if comment.status !== "active"}<Badge variant="outline">{statusLabel(comment.status)}</Badge>{/if}
        {#if comment.contextLabel}
          <Badge variant="outline">{commentCopy.postedIn} {comment.contextLabel}</Badge>
        {/if}
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-base-content/60 text-xs">
        <a class="hover:underline" href={`#comment-${comment.id}`}>{formatTime(comment.createdAt)}</a>
        {#if comment.updatedAt !== comment.createdAt}
          <span>{commentCopy.editedLabel} {formatTime(comment.updatedAt)}</span>
        {/if}
      </div>
    </div>
  </div>
  <CommentThreadHeaderActions
    bind:actionMenuId
    {comment}
    {commentCopy}
    {copyCommentLink}
    {openDeleteDialog}
    {startEdit}
    {toggleReply}
  />
</div>
