<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { MenuRadioItem } from "@ui-sdk/svelte/menu";
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children: childrenProp,
		...restProps
	}: ComponentProps<typeof MenuRadioItem> & { ref?: HTMLElement | null } = $props();
</script>

<MenuRadioItem closeOnSelect
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="dropdown-menu-radio-item"
	class={cn(
		"focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm data-inset:pl-7 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
	{...restProps}
>
	{#snippet children(state)}
		<span
			class="absolute right-2 flex items-center justify-center pointer-events-none"
			data-slot="dropdown-menu-radio-item-indicator"
		>
			{#if state.checked}
				<CheckIcon  />
			{/if}
		</span>
		{@render childrenProp?.(state)}
	{/snippet}
</MenuRadioItem>
