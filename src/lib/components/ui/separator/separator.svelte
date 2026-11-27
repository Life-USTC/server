<script lang="ts">
	import { Separator } from "@ui-sdk/svelte/separator";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		"data-slot": dataSlot = "separator",
		...restProps
	}: ComponentProps<typeof Separator> & { ref?: HTMLDivElement | null } = $props();
</script>

<Separator
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	data-slot={dataSlot}
	class={cn(
		"bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
		// this is different in shadcn/ui but self-stretch breaks things for us
		"data-[orientation=vertical]:h-full",
		className
	)}
	{...restProps}
/>
