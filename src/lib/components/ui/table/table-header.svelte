<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import { cn, type WithElementRef } from "$lib/utils.js";

let {
  ref = $bindable(null),
  class: className,
  children,
  ...restProps
}: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props();
</script>

<thead
	bind:this={ref}
	data-slot="table-header"
	class={cn("border-base-300 border-b bg-base-200/60 text-base-content/60 [&_tr]:border-0", className)}
	{...restProps}
>
	{@render children?.()}
</thead>
