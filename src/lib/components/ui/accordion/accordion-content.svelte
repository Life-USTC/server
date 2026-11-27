<script lang="ts">
	import { AccordionPanel } from "@ui-sdk/svelte/accordion";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children: content,
		...restProps
	}: ComponentProps<typeof AccordionPanel> & { ref?: HTMLDivElement | null } = $props();
</script>

<AccordionPanel
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="accordion-content"
	class="data-open:animate-accordion-down data-closed:animate-accordion-up text-sm overflow-hidden"
	{...restProps}
>
	{#snippet children(state)}
	<div
		class={cn(
			"pt-0 pb-2.5 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
			className
		)}
	>
		{@render content?.(state)}
	</div>
	{/snippet}
</AccordionPanel>
