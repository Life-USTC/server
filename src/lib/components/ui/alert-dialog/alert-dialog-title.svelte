<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { AlertDialogTitle } from "@ui-sdk/svelte/alert-dialog";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof AlertDialogTitle> & { ref?: HTMLElement | null } = $props();
</script>

<AlertDialogTitle
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="alert-dialog-title"
	class={cn("text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2", className)}
	{...restProps}
/>
