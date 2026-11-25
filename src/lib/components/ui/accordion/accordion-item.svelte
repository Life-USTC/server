<script lang="ts">
	import { AccordionItem } from "@ui-sdk/svelte/accordion";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof AccordionItem> & { ref?: HTMLDivElement | null } = $props();
</script>

<AccordionItem
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="accordion-item"
	class={cn("not-last:border-b", className)}
	{...restProps}
/>
