<script lang="ts">
import type { ReactionOption } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import { cn } from "$lib/utils.js";
import type { CommentsCopy } from "./comment-component-types";

export let comment: CommentNode;
export let commentCopy: CommentsCopy;
export let pendingReactionKey: string | null;
export let react: (comment: CommentNode, type: string) => void;
export let reactionEntry: (
  comment: CommentNode,
  type: string,
) =>
  | {
      count: number;
      viewerHasReacted: boolean;
    }
  | undefined;
export let reactionKey: (commentId: string, type: string) => string;
export let reactionLabel: (type: string) => string;
export let reactionMenuId: string | null;
export let reactionName: (type: string) => string;
export let reactionOptions: ReactionOption[];
export let viewer: ViewerContext;

$: if (
  (!comment.canReact || viewer.isSuspended) &&
  reactionMenuId === comment.id
) {
  reactionMenuId = null;
}
</script>

<div class="flex flex-wrap items-center gap-2">
  <div class="relative">
    <DropdownMenu.Root
      open={reactionMenuId === comment.id}
      onOpenChange={(open) => {
        reactionMenuId = open ? comment.id : null;
      }}
    >
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-label={commentCopy.reactionMenu}
            disabled={!comment.canReact}
            size="sm"
            variant="outline"
          >
            {commentCopy.reactionMenu}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-56" preventScroll={false}>
        <DropdownMenu.Group>
          {#each reactionOptions as option}
            <DropdownMenu.CheckboxItem
              checked={reactionEntry(comment, option.type)?.viewerHasReacted ?? false}
              class={cn(
                reactionEntry(comment, option.type)?.viewerHasReacted &&
                  "bg-accent font-semibold text-accent-foreground",
                pendingReactionKey && "opacity-70",
              )}
              disabled={!comment.canReact || Boolean(pendingReactionKey)}
              onSelect={() => react(comment, option.type)}
            >
              <span>{option.emoji}</span>
              <span>{reactionName(option.type)}</span>
              {#if (reactionEntry(comment, option.type)?.count ?? 0) > 0}
                <span class="ml-auto text-muted-foreground text-xs">
                  {reactionEntry(comment, option.type)?.count}
                </span>
              {/if}
            </DropdownMenu.CheckboxItem>
          {/each}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
  {#each comment.reactions as reaction}
    <Button
      aria-label={`${reactionLabel(reaction.type)} ${reaction.count}`}
      class={reaction.viewerHasReacted ? "border-primary/40 bg-primary/10 text-primary" : ""}
      disabled={!comment.canReact || pendingReactionKey === reactionKey(comment.id, reaction.type)}
      size="sm"
      type="button"
      variant="outline"
      onclick={() => react(comment, reaction.type)}
    >
      {reactionLabel(reaction.type)} {reaction.count}
    </Button>
  {/each}
</div>
