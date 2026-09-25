<script lang="ts">
import type { Snippet } from "svelte";
import { Badge } from "$lib/components/ui/badge";

let {
  summary,
  page,
  totalPages,
  children,
}: { summary: string; page?: number; totalPages?: number; children?: Snippet } =
  $props();
</script>
<div class="flex min-w-0 flex-wrap items-center justify-between gap-3" data-slot="results-summary">
  <p class="text-sm text-muted-foreground" aria-live="polite">{summary}{#if children} {@render children()}{/if}</p>
  {#if page != null && totalPages != null && totalPages > 0}<Badge variant="ghost">{page} / {totalPages}</Badge>{/if}
</div>
