<script lang="ts">
	import { TabsPanel } from "@ui-sdk/svelte/tabs";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof TabsPanel> & { ref?: HTMLDivElement | null } = $props();
</script>

<TabsPanel
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="tabs-content"
	class={cn("text-sm flex-1 outline-none", className)}
	{...restProps}
/>
