<script lang="ts">
import type { Snippet } from "svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { cn } from "$lib/utils.js";

type PageFrameWidth = "reading" | "content" | "wide" | "full";

type Props = {
  children: Snippet;
  class?: string;
  description?: string;
  title: string;
  width?: PageFrameWidth;
};

let {
  children,
  class: className = "",
  description = "",
  title,
  width = "wide",
}: Props = $props();

const widthClasses: Record<PageFrameWidth, string> = {
  reading: "page-frame-reading",
  content: "page-frame-content",
  wide: "",
  full: "page-frame-full",
};
</script>

<section
  class={cn(
    "page-frame grid gap-5",
    widthClasses[width],
    className,
  )}
  data-slot="page-layout"
>
  <PageHeader {description} {title} />
  <div class="min-w-0" data-slot="page-layout-content">
    {@render children()}
  </div>
</section>
