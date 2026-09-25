<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type PageFrameWidth = "reading" | "content" | "wide" | "full";
let {
  children,
  header,
  class: className,
  width = "wide",
}: {
  children: Snippet;
  header?: Snippet;
  class?: string;
  width?: PageFrameWidth;
} = $props();
const widthClasses: Record<PageFrameWidth, string> = {
  reading: "page-frame-reading",
  content: "page-frame-content",
  wide: "",
  full: "page-frame-full",
};
</script>

<section class={cn("page-frame grid gap-5", widthClasses[width], className)} data-slot="page-layout">
  {#if header}{@render header()}{/if}
  <div class="grid min-w-0 gap-5" data-slot="page-layout-content">{@render children()}</div>
</section>
