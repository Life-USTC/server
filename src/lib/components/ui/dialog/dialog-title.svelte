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
	data-slot="dialog-title"
	class={cn("text-base leading-none font-medium", className)}
	{...restProps}
/>
