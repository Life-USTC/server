<script lang="ts">
import type { PluggableList } from "unified";
import { renderMarkdown } from "$lib/components/markdown-preview-renderer";
import * as Empty from "$lib/components/ui/empty/index.js";
import { cn } from "$lib/utils.js";
import "$lib/components/markdown-preview.css";
import "katex/dist/katex.min.css";

export let content = "";
export let emptyLabel = "";
export let remarkPlugins: PluggableList = [];
let className = "";

export { className as class };

$: renderedHtml = content.trim()
  ? renderMarkdown(content, { remarkPlugins })
  : "";
</script>

<div class={cn("markdown-preview grid gap-3 text-sm leading-6", className)} data-slot="markdown-preview">
  {#if renderedHtml}
    {@html renderedHtml}
  {:else if emptyLabel}
    <Empty.Root class="min-h-24">
      <Empty.Header>
        <Empty.Description>{emptyLabel}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</div>
