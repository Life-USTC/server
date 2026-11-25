<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { DialogBackdrop } from "@ui-sdk/svelte/dialog";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof DialogBackdrop> & { ref?: HTMLElement | null } = $props();
</script>

<DialogBackdrop
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="sheet-overlay"
	class={cn("bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", className)}
	{...restProps}
/>
