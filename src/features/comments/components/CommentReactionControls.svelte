<script lang="ts">
import type { ReactionOption } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
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
    <Menu.Root
      open={reactionMenuId === comment.id}
      onOpenChange={(open) => {
        reactionMenuId = open ? comment.id : null;
      }}
    >
      <Menu.Trigger
        aria-label={commentCopy.reactionMenu}
        disabled={!comment.canReact}
        size="sm"
        variant="outline"
      >
        {commentCopy.reactionMenu}
      </Menu.Trigger>
      <Menu.Content class="w-56">
        {#each reactionOptions as option}
          <Menu.CheckboxItem
            checked={reactionEntry(comment, option.type)?.viewerHasReacted ?? false}
            class={`${reactionEntry(comment, option.type)?.viewerHasReacted ? "bg-base-200 font-semibold" : ""} ${pendingReactionKey ? "opacity-70" : ""}`}
            disabled={!comment.canReact || Boolean(pendingReactionKey)}
            onclick={() => react(comment, option.type)}
          >
            <span>{option.emoji}</span>
            <span>{reactionName(option.type)}</span>
            {#if (reactionEntry(comment, option.type)?.count ?? 0) > 0}
              <span class="ml-auto text-base-content/60 text-xs">
                {reactionEntry(comment, option.type)?.count}
              </span>
            {/if}
          </Menu.CheckboxItem>
        {/each}
      </Menu.Content>
    </Menu.Root>
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
