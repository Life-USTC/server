<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "#lib/utils.js";
import { detailColumnsClass } from "./detail-layout";

let {
  header,
  children,
  aside,
}: {
  header: Snippet;
  children: Snippet;
  aside?: Snippet;
} = $props();
</script>
<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0" data-slot="detail-page-layout">
  <div class="bg-card"><div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">{@render header()}</div></div>
  <div class="@container/detail min-h-0 min-w-0 lg:overflow-y-auto" data-detail-scroll-container>
    <div
      class={cn(
        "page-frame page-frame-content min-h-full px-4 py-4 sm:px-5 lg:px-6",
        aside && detailColumnsClass,
      )}
    >
      <div class="min-w-0" data-detail-reading-stream>{@render children()}</div>
      {#if aside}
        <aside class="grid min-w-0 gap-6 @[60rem]/detail:sticky @[60rem]/detail:top-4">{@render aside()}</aside>
      {/if}
    </div>
  </div>
</section>

<style>
  @media (min-width: 1024px) {
    :global([data-shell-detail-workspace="true"]) [data-slot="detail-page-layout"] {
      height: 100%;
      min-height: 0;
    }
  }
</style>
