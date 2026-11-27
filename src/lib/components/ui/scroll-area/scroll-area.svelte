<script lang="ts">
  import { ScrollArea, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@ui-sdk/svelte/scroll-area";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "#lib/utils.js";

  let { class: className, orientation = "vertical", children, ...props }: HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical" | "both";
  } = $props();
</script>

<ScrollArea class={cn("relative", className)} {...props}>
  <ScrollAreaViewport tabindex={0} class="size-full rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
    <ScrollAreaContent>{@render children?.()}</ScrollAreaContent>
  </ScrollAreaViewport>
  {#each (["vertical", "horizontal"] as const) as axis (axis)}
    {#if orientation === "both" || orientation === axis}
      <ScrollAreaScrollbar orientation={axis} class="absolute touch-none select-none p-px data-[orientation=vertical]:inset-y-0 data-[orientation=vertical]:right-0 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:inset-x-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:h-2.5">
        <ScrollAreaThumb class="block rounded-full bg-border" />
      </ScrollAreaScrollbar>
    {/if}
  {/each}
</ScrollArea>
