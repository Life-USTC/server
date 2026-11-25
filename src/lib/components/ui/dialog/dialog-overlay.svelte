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
	data-slot="dialog-overlay"
	class={cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50", className)}
	{...restProps}
/>
