<script lang="ts">
import { renderMarkdown } from "$lib/components/markdown-preview-renderer";
import "$lib/components/markdown-preview.css";
import "katex/dist/katex.min.css";

export let content = "";
export let emptyLabel = "";
let className = "";

export { className as class };

$: renderedHtml = content.trim() ? renderMarkdown(content) : "";
</script>

<div class={`markdown-preview grid gap-3 text-sm leading-6 ${className}`} data-slot="markdown-preview">
  {#if renderedHtml}
    {@html renderedHtml}
  {:else if emptyLabel}
    <p class="text-base-content/60">{emptyLabel}</p>
  {/if}
</div>
