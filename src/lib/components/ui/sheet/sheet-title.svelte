<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { DialogTitle } from "@ui-sdk/svelte/dialog";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof DialogTitle> & { ref?: HTMLElement | null } = $props();
</script>

<DialogTitle
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="sheet-title"
	class={cn("text-foreground text-base font-medium", className)}
	{...restProps}
/>
