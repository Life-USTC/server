<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { AlertDialogDescription } from "@ui-sdk/svelte/alert-dialog";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof AlertDialogDescription> & { ref?: HTMLElement | null } = $props();
</script>

<AlertDialogDescription
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="alert-dialog-description"
	class={cn("text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3", className)}
	{...restProps}
/>
