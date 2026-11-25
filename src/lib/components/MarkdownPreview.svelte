<script lang="ts">
import type { PluggableList } from "unified";
import EmptyState from "#lib/components/EmptyState.svelte";
import { renderEmbeddedMarkdown } from "#lib/components/markdown-preview-renderer.js";
import { cn } from "#lib/utils.js";
import "#lib/components/markdown-preview.css";
import katexStylesheet from "katex/dist/katex.min.css?url";

export let content = "";
export let emptyLabel = "";
export let remarkPlugins: PluggableList = [];
let className = "";

export { className as class };

$: renderedHtml = content.trim()
  ? renderEmbeddedMarkdown(content, { remarkPlugins })
  : "";
</script>

<svelte:head>
  {#if renderedHtml?.includes('class="katex')}
    <link rel="stylesheet" href={katexStylesheet} />
  {/if}
</svelte:head>

<div class={cn("markdown-preview text-sm", className)} data-slot="markdown-preview">
  {#if renderedHtml}
    {@html renderedHtml}
  {:else if emptyLabel}
    <EmptyState class="min-h-24" description={emptyLabel} />
  {/if}
</div>
