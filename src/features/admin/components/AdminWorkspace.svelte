<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type Props = {
  children: Snippet;
  compact?: boolean;
  controls?: Snippet;
  feedback?: Snippet;
  header: Snippet;
  summary?: Snippet;
};

let {
  children,
  controls,
  feedback,
  header,
  summary,
  compact = false,
}: Props = $props();
</script>

<div class="page-frame page-frame-full w-full min-w-0">
  <section
    class={cn("grid min-w-0 [&>header]:min-w-0 [&>section]:min-w-0 [&>div]:min-w-0", compact ? "gap-4 rounded-xl bg-muted/30 p-3 sm:p-4" : "gap-8")}
    data-testid="admin-workspace"
  >
    {@render header()}
    {#if feedback}{@render feedback()}{/if}
    {#if summary}{@render summary()}{/if}
    {#if controls}{@render controls()}{/if}
    {@render children()}
  </section>
</div>
