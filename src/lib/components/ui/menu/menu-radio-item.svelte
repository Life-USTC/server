<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";
import { cn } from "$lib/utils.js";

let {
  class: className,
  destructive = false,
  onclick,
  ...restProps
}: MenuPrimitive.RadioItemProps & {
  destructive?: boolean;
  onclick?: (event: Event) => void;
} = $props();

const itemClass =
  "flex w-full cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-base-200 data-[highlighted]:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:bg-base-200";

function handleSelect(event: Event) {
  onclick?.(event);
}
</script>

<MenuPrimitive.RadioItem
  class={cn(itemClass, destructive && "text-error", className)}
  onSelect={handleSelect}
  {...restProps}
/>
