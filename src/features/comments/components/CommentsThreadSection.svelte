<script lang="ts">
import type { Snippet } from "svelte";
import CompactEmpty from "#lib/components/CompactEmpty.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import type { CommentTargetLoadState } from "@/features/comments/lib/comment-panel-data";
import type { CommentNodeWithContext } from "@/features/comments/lib/comment-ui";
import type { CommentsCopy } from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let comments: CommentNodeWithContext[];
export let highlightedId: string | null;
export let loading: boolean;
export let loadingReplyRootId: string | null;
export let loadingTargetKey: string | null;
export let loadMoreComments: (targetKey: string) => void;
export let loadMoreReplies: (rootId: string) => void;
export let loadTarget: (targetKey: string) => void;
export let targetLoadStates: CommentTargetLoadState[];

export let renderItem: Snippet<[CommentNodeWithContext]>;

function canLoadTarget(state: CommentTargetLoadState) {
  return Boolean(
    state.target.type !== "section-teacher" || state.target.teacherId,
  );
}

function hasTargetContinuation(state: CommentTargetLoadState) {
  return (
    canLoadTarget(state) &&
    ((!state.loaded && state.page === 0) ||
      (state.loaded && state.page < state.totalPages))
  );
}
</script>

{#snippet commentItem(comment: CommentNodeWithContext, depth = 0)}
  <article
    class={`grid min-w-0 gap-3 border-b border-border/70 py-4 last:border-b-0 ${
      highlightedId === comment.id ? "rounded-lg ring-2 ring-primary/40" : ""
    }`}
    id={`comment-${comment.id}`}
    style={`padding-left: ${Math.min(depth, 3) * 1.25}rem`}
  >
    {#if comment.isAncestryPlaceholder}
      <p class="text-muted-foreground text-sm">{commentCopy.ancestryPlaceholder}</p>
    {:else}
      {@render renderItem(comment)}
    {/if}
  </article>

  {#each comment.replies as reply}
    {@render commentItem(reply, depth + 1)}
  {/each}

  {#if comment.repliesNextCursor && comment.parentId === null}
    <Button
      class="ml-2"
      disabled={loadingReplyRootId === comment.id}
      size="sm"
      variant="ghost"
      onclick={() => loadMoreReplies(comment.id)}
    >
      {commentCopy.loadMoreReplies}
    </Button>
  {/if}
{/snippet}

{#if loading}
  <div class="grid gap-3">
    <Skeleton class="h-24 w-full" />
    <Skeleton class="h-24 w-full" />
  </div>
{:else}
  {#if targetLoadStates.some(hasTargetContinuation)}
    <div
      class="mb-4 flex min-w-0 flex-wrap gap-2"
      data-testid="comment-target-load-controls"
    >
      {#each targetLoadStates as state}
        {#if !state.loaded && canLoadTarget(state)}
          <Button
            class="min-w-0 max-w-full whitespace-normal break-words"
            disabled={loadingTargetKey !== null}
            size="sm"
            variant="outline"
            onclick={() => loadTarget(state.target.key)}
          >
            {state.target.label}: {commentCopy.loadTarget}
          </Button>
        {:else if state.loaded && state.page < state.totalPages}
          <Button
            class="min-w-0 max-w-full whitespace-normal break-words"
            disabled={loadingTargetKey !== null}
            size="sm"
            variant="outline"
            onclick={() => loadMoreComments(state.target.key)}
          >
            {state.target.label}: {commentCopy.loadMoreComments}
          </Button>
        {/if}
      {/each}
    </div>
  {/if}

  {#if comments.length === 0 && targetLoadStates.some((state) => state.loaded)}
    <CompactEmpty
      title={commentCopy.emptyTitle}
      description={commentCopy.emptyDescription}
    />
  {:else}
    <div class="grid min-w-0 gap-4">
      {#each comments as comment}
        {@render commentItem(comment)}
      {/each}
    </div>
  {/if}
{/if}
