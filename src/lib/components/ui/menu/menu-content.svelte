<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";
import { cn } from "$lib/utils.js";

let {
  ref = $bindable(null),
  class: className,
  align = "start",
  preventScroll = false,
  sideOffset = 4,
  ...restProps
}: MenuPrimitive.ContentProps = $props();
</script>

<MenuPrimitive.Portal>
  <MenuPrimitive.Content
    bind:ref
    data-slot="menu"
    {preventScroll}
    {sideOffset}
    {align}
    class={cn(
      "z-50 grid min-w-40 gap-1 rounded-md border border-base-300 bg-base-100 p-1 text-base-content shadow-lg outline-none",
      className,
    )}
    {...restProps}
  />
</MenuPrimitive.Portal>
