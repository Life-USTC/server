<script lang="ts">
	import type { ButtonProps } from "#lib/components/ui/button/index.js";
	import {
		Button,
		type ButtonVariant,
		type ButtonSize,
	} from "#lib/components/ui/button/index.js";
	import { cn, type WithoutChildrenOrChild } from "#lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		size = "default",
		disabled,
		children,
		...restProps
	}: ButtonProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		children?: Snippet;
	} = $props();
</script>

<Button
  bind:ref
  data-slot="alert-dialog-action"
  {variant}
  {size}
  class={cn("cn-alert-dialog-action", className)}
  {disabled}
  {...restProps}
>
  {@render children?.()}
</Button>
