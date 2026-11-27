<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { AlertDialogClose } from "@ui-sdk/svelte/alert-dialog";
	import {
		Button,
		type ButtonVariant,
		type ButtonSize,
	} from "#lib/components/ui/button/index.js";
	import { cn } from "#lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		variant = "outline",
		size = "default",
		disabled,
		children,
		...restProps
	}: ComponentProps<typeof AlertDialogClose> & { ref?: HTMLElement | null } & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		children?: Snippet;
	} = $props();
</script>

<AlertDialogClose
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="alert-dialog-cancel"
	disabled={disabled}
	{...restProps}
>
	{#snippet render({ props })}
		<Button
			{...props}
			variant={variant}
			size={size}
			class={cn("cn-alert-dialog-cancel", className)}
			disabled={disabled}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogClose>
