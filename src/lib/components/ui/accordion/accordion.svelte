<script lang="ts">
	import { Accordion } from "@ui-sdk/svelte/accordion";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		value = $bindable<string[]>([]),
		class: className,
		...restProps
	}: ComponentProps<typeof Accordion> & { ref?: HTMLDivElement | null } = $props();
</script>

<Accordion
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	bind:value
	collapsible
	data-slot="accordion"
	class={cn("cn-accordion flex w-full flex-col", className)}
	{...restProps}
/>
