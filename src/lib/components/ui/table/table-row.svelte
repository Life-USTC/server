<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn, type WithElementRef } from "$lib/utils.js";

let {
  ref = $bindable(null),
  class: className,
  children,
  ...restProps
}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr bind:this={ref} data-slot="table-row" class={cn("border-base-300 border-b transition-colors hover:bg-base-200/50 data-[state=selected]:bg-base-200", className)} {...restProps}>
	{@render children?.()}
</tr>
