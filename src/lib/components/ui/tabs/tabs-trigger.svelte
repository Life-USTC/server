<script lang="ts">
	import { TabsTab } from "@ui-sdk/svelte/tabs";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof TabsTab> & { ref?: HTMLButtonElement | null } = $props();
</script>

<TabsTab
	{@attach (element: HTMLButtonElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="tabs-trigger"
	class={cn(
		"gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 group-data-[variant=default]/tabs-list:aria-selected:shadow-sm group-data-[variant=line]/tabs-list:aria-selected:shadow-none [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:aria-selected:bg-transparent dark:group-data-[variant=line]/tabs-list:aria-selected:border-transparent dark:group-data-[variant=line]/tabs-list:aria-selected:bg-transparent",
		"aria-selected:bg-background dark:aria-selected:text-foreground dark:aria-selected:border-input dark:aria-selected:bg-input/30 aria-selected:text-foreground",
		"after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:aria-selected:after:opacity-100",
		className
	)}
	{...restProps}
/>
