<script lang="ts">
	import { Label } from "@ui-sdk/svelte/label";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof Label> & { ref?: HTMLLabelElement | null } = $props();
</script>

<Label
	{@attach (element: HTMLLabelElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="label"
	class={cn(
		"gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
		className
	)}
	{...restProps}
/>
