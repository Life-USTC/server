<script lang="ts">
import type { Snippet } from "svelte";

let {
  header,
  children,
  aside,
}: { header: Snippet; children: Snippet; aside: Snippet } = $props();
</script>
<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0" data-slot="detail-page-layout">
  <div class="bg-card"><div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">{@render header()}</div></div>
  <div class="min-h-0 min-w-0 overflow-y-auto" data-detail-scroll-container>
    <div class="page-frame page-frame-content grid min-h-full gap-8 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10 lg:px-6">
      <div class="grid min-w-0 gap-10">{@render children()}</div>
      <aside class="grid min-w-0 gap-6 lg:sticky lg:top-4">{@render aside()}</aside>
    </div>
  </div>
</section>
