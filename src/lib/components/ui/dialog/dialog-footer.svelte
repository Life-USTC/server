<script lang="ts">

	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import { DialogClose } from "@ui-sdk/svelte/dialog";
	import { Button } from "#lib/components/ui/button/index.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		showCloseButton = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		showCloseButton?: boolean;
	} & { children?: import("svelte").Snippet } = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn("bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
	{...restProps}
>
	{@render children?.()}
	{#if showCloseButton}
		<DialogClose>
			{#snippet render({ props })}
				<Button variant="outline" {...props}>Close</Button>
			{/snippet}
		</DialogClose>
	{/if}
</div>
