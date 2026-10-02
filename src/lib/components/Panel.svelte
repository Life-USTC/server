<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

/**
 * Unframed page section. Content pages use CollectionPage. Put Panel inside
 * that template when one page has several sections.
 */
type Props = {
  children: Snippet;
  class?: string;
  footer?: Snippet;
  header?: Snippet;
};

let { children, class: className = "", footer, header }: Props = $props();
</script>

<section class={cn("grid min-w-0 gap-4", className)} data-slot="page-section">
  {#if header}
    <div class="grid min-w-0 gap-3" data-slot="page-section-header">{@render header()}</div>
  {/if}
  <div class="grid min-w-0 gap-3" data-slot="page-section-body">{@render children()}</div>
  {#if footer}
    <div class="flex justify-center" data-slot="page-section-footer">{@render footer()}</div>
  {/if}
</section>
