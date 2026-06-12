<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";

export let align: "left" | "right" = "left";
let className = "";

export { className as class };

$: alignmentClass = align === "right" ? "right-0" : "left-0";
</script>

<MenuPrimitive.Root open={true}>
  <MenuPrimitive.ContentStatic
    class={`absolute ${alignmentClass} z-20 mt-1 grid w-40 gap-1 rounded-md border border-base-300 bg-base-100 p-1 shadow-lg outline-none ${className}`}
    data-slot="menu"
    loop
    {...$$restProps}
  >
    <slot />
  </MenuPrimitive.ContentStatic>
</MenuPrimitive.Root>
