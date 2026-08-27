<script lang="ts">
	import type { HTMLTableAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		containerLabel,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> & {
		containerLabel?: string;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (focus enables keyboard scrolling for overflowing tables) -->
<div
	data-slot="table-container"
	class="relative w-full overflow-x-auto"
	role={containerLabel ? "region" : undefined}
	aria-label={containerLabel}
	tabindex={containerLabel ? 0 : undefined}
>
	<table bind:this={ref} data-slot="table" class={cn("w-full caption-bottom text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>
