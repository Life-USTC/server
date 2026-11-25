<script lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/svelte/avatar";
import { Badge } from "#lib/components/ui/badge/index.js";
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { commentPanelStatusLabel } from "../lib/comment-panel-controller";
import { commentAuthorInitials, commentAuthorName } from "../lib/comment-ui";
import CommentThreadHeaderActions from "./CommentThreadHeaderActions.svelte";
import type { CommentsCopy } from "./comment-component-types";

export let actionMenuId: string | null;
export let comment: CommentNodeWithContext;
export let commentCopy: CommentsCopy;
export let copyCommentLink: (comment: CommentNode) => void;
export let formatTime: (value: string) => string;
export let openDeleteDialog: (comment: CommentNode) => void;
export let startEdit: (comment: CommentNode) => void;
export let toggleReply: (comment: CommentNode) => void;
$: author = commentAuthorName(comment, commentCopy.anonymousLabel);
</script>

<div class="flex flex-wrap items-start justify-between gap-3">
  <div class="flex min-w-0 flex-1 items-start gap-3">
    <Avatar>
      {#if !comment.authorHidden && comment.author?.image}
        <AvatarImage src={comment.author.image} alt={author} />
      {/if}
      <AvatarFallback>{commentAuthorInitials(comment, commentCopy.anonymousLabel)}</AvatarFallback>
    </Avatar>
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-semibold text-sm">{author}</h3>
        {#if comment.author?.isUstcVerified}<Badge variant="secondary">{commentCopy.ustcVerified}</Badge>{/if}
        {#if comment.isAuthor && comment.isAnonymous}<Badge variant="outline">{commentCopy.anonymousBadge}</Badge>{/if}
        {#if comment.visibility === "logged_in_only"}<Badge variant="outline">{commentCopy.visibilityLoggedIn}</Badge>{/if}
        {#if comment.status !== "active"}<Badge variant="outline">{commentPanelStatusLabel(comment.status, commentCopy)}</Badge>{/if}
        {#if comment.contextLabel}
          <Badge class="h-auto max-w-full whitespace-normal break-words text-left" variant="outline">
            {commentCopy.postedIn} {comment.contextLabel}
          </Badge>
        {/if}
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
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
