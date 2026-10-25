<script lang="ts">
import type { Snippet } from "svelte";

let { summary, children }: { summary: string; children?: Snippet } = $props();
</script>
<div class="flex min-w-0 flex-wrap items-center justify-between gap-3" data-slot="results-summary">
  <p class="text-sm text-muted-foreground" aria-live="polite">{summary}{#if children} {@render children()}{/if}</p>
</div>
