<script lang="ts">
import type { ComponentProps } from "svelte";
import * as Item from "#lib/components/ui/item/index.js";
import { cn } from "#lib/utils.js";

let {
  class: className,
  size = "sm",
  ...props
}: ComponentProps<typeof Item.Root> = $props();
</script>

<Item.Root {size} class={cn("min-w-0 items-start", className)} {...props} />
