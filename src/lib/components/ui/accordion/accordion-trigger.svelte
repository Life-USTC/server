<script lang="ts">
	import { AccordionTrigger, AccordionHeader } from "@ui-sdk/svelte/accordion";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';

	let {
		ref = $bindable(null),
		class: className,
		level = 3,
		children: content,
		...restProps
	}: ComponentProps<typeof AccordionTrigger> & { ref?: HTMLButtonElement | null } & {
		level?: 1 | 2 | 3 | 4 | 5 | 6;
	} = $props();
</script>

<AccordionHeader aria-level={level} class="flex">
	<AccordionTrigger
		data-slot="accordion-trigger"
		{@attach (element: HTMLButtonElement) => { ref = element; return () => { ref = null; }; }}
		class={cn(
			"focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-lg py-2.5 text-left text-sm font-medium hover:underline focus-visible:ring-3 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none disabled:pointer-events-none disabled:opacity-50",
			className
		)}
		{...restProps}
	>
		{#snippet children(state)}
			{@render content?.(state)}
			<ChevronDownIcon data-slot="accordion-trigger-icon" class="cn-accordion-trigger-icon pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden" />
			<ChevronUpIcon data-slot="accordion-trigger-icon" class="cn-accordion-trigger-icon pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline" />
		{/snippet}
	</AccordionTrigger>
</AccordionHeader>
