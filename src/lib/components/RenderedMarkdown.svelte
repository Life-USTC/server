<script lang="ts">
import EmptyState from "#lib/components/EmptyState.svelte";
import { cn } from "#lib/utils.js";
import "#lib/components/markdown-preview.css";
import katexStylesheet from "katex/dist/katex.min.css?url";

export let html = "";
export let emptyLabel = "";
let className = "";

export { className as class };
</script>

<svelte:head>
  {#if html?.includes('class="katex')}
    <link rel="stylesheet" href={katexStylesheet} />
  {/if}
</svelte:head>

<div class={cn("markdown-preview text-sm", className)} data-slot="markdown-preview">
  {#if html}
    {@html html}
  {:else if emptyLabel}
    <EmptyState class="min-h-24" description={emptyLabel} />
  {/if}
</div>
