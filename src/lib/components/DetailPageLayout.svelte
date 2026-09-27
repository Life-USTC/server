<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";
import { detailColumnsClass } from "./detail-layout";

let {
  header,
  children,
  aside,
}: { header: Snippet; children: Snippet; aside: Snippet } = $props();
</script>
<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0" data-slot="detail-page-layout">
  <div class="bg-card"><div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">{@render header()}</div></div>
  <div class="min-h-0 min-w-0 overflow-y-auto" data-detail-scroll-container>
    <div class={cn("page-frame page-frame-content min-h-full px-4 py-4 sm:px-5 lg:px-6", detailColumnsClass)}>
      <div class="grid min-w-0 gap-10">{@render children()}</div>
      <aside class="grid min-w-0 gap-6 lg:sticky lg:top-4">{@render aside()}</aside>
    </div>
  </div>
</section>
