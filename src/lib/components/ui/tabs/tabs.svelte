<script lang="ts">
	import { Tabs } from "@ui-sdk/svelte/tabs";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		value = $bindable(""),
		onValueChange,
		class: className,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { value?: string; onValueChange?: (value: string) => void; orientation?: "horizontal" | "vertical" } & { ref?: HTMLDivElement | null } = $props();
</script>

<Tabs
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	value={value}
	onValueChange={(next) => { if (next !== null) { value = next; onValueChange?.(next); } }}
	data-slot="tabs"
	class={cn("gap-2 group/tabs flex data-[orientation=horizontal]:flex-col", className)}
	{...restProps}
/>
