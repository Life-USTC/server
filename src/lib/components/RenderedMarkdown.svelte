<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import { cn } from "$lib/utils.js";
import "$lib/components/markdown-preview.css";
import "katex/dist/katex.min.css";

export let html = "";
export let emptyLabel = "";
let className = "";

export { className as class };
</script>

<div class={cn("markdown-preview grid gap-3 text-sm leading-6", className)} data-slot="markdown-preview">
  {#if html}
    {@html html}
  {:else if emptyLabel}
    <Empty.Root class="min-h-24">
      <Empty.Header>
        <Empty.Description>{emptyLabel}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</div>
