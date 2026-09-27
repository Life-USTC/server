<script lang="ts">
import type { Snippet } from "svelte";

let {
  header,
  identity,
  children,
  aside,
}: { header: Snippet; identity: Snippet; children: Snippet; aside: Snippet } =
  $props();
</script>
<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0" data-slot="detail-page-layout">
  <div class="bg-card"><div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">{@render header()}</div></div>
  <div class="min-h-0 min-w-0 overflow-y-auto" data-detail-scroll-container>
    <div class="page-frame page-frame-content grid min-h-full gap-8 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-10 lg:px-6">
      <div class="min-w-0 lg:col-start-2 lg:row-start-1" data-detail-identity>{@render identity()}</div>
      <div class="grid min-w-0 grid-cols-1 gap-10 lg:col-start-1 lg:row-start-1 lg:row-span-2" data-detail-reading-stream>{@render children()}</div>
      <aside class="grid min-w-0 gap-6 lg:col-start-2 lg:row-start-2">{@render aside()}</aside>
    </div>
  </div>
</section>
