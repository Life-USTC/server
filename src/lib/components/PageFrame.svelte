<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

export type PageFrameWidth = "reading" | "content" | "wide" | "full";

type Props = {
  children: Snippet;
  class?: string;
  width?: PageFrameWidth;
};

const widthClasses: Record<PageFrameWidth, string> = {
  reading: "max-w-4xl",
  content: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

let { children, class: className = "", width = "wide" }: Props = $props();
</script>

<div
  class={cn("mx-auto w-full min-w-0", widthClasses[width], className)}
  data-page-frame={width}
>
  {@render children()}
</div>
