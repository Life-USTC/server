<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import {
		Button,
		type ButtonVariant,
		type ButtonSize,
	} from "$lib/components/ui/button/index.js";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		size = "default",
		disabled,
		children,
		...restProps
	}: WithoutChildrenOrChild<AlertDialogPrimitive.ActionProps> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		children?: Snippet;
	} = $props();
</script>

<AlertDialogPrimitive.Action
	bind:ref
	data-slot="alert-dialog-action"
	disabled={disabled}
	{...restProps}
>
	{#snippet child({ props })}
		<Button
			{...props}
			variant={variant}
			size={size}
			class={cn("cn-alert-dialog-action", className)}
			disabled={disabled}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogPrimitive.Action>
