<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { DialogDescription } from "@ui-sdk/svelte/dialog";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof DialogDescription> & { ref?: HTMLElement | null } = $props();
</script>

<DialogDescription
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="sheet-description"
	class={cn("text-muted-foreground text-sm", className)}
	{...restProps}
/>
