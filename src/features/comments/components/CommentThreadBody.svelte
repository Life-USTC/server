<script lang="ts">
import RenderedMarkdown from "#lib/components/RenderedMarkdown.svelte";
import type { CommentNode } from "@/features/comments/server/comment-types";
import CommentAttachmentCards from "./CommentAttachmentCards.svelte";
import CommentLinkCards from "./CommentLinkCards.svelte";
import type { CommentsCopy } from "./comment-component-types";

export let comment: CommentNode;
export let commentCopy: CommentsCopy;
</script>

{#if comment.status === "deleted"}
  <p class="text-muted-foreground text-sm">{commentCopy.deletedMessage}</p>
{:else}
  <RenderedMarkdown
    class="break-words"
    html={comment.renderedBody}
  />
  <CommentLinkCards content={comment.body} copy={commentCopy} />
{/if}

<CommentAttachmentCards attachments={comment.attachments} openLabel={commentCopy.openAttachment} />
