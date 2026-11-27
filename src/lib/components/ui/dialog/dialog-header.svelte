<script lang="ts">
	import { DialogDescription, DialogTitle } from "@ui-sdk/svelte/dialog";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		heading,
		titleId,
		description,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		heading?: string;
		titleId?: string;
		description?: string;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-header"
	class={cn("gap-2 flex flex-col", className, "pr-10")}
	{...restProps}
>
	{#if heading !== undefined}<DialogTitle id={titleId}>{heading}</DialogTitle>{/if}
	{#if description !== undefined}<DialogDescription>{description}</DialogDescription>{/if}
	{@render children?.()}
</div>
