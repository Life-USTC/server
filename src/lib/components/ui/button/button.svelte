<script lang="ts">
import type { HTMLLabelAttributes } from "svelte/elements";
import { cn } from "$lib/utils.js";
import { type ButtonProps, buttonVariants } from "./button-variants.js";

let {
  class: className,
  variant = "default",
  size = "default",
  as = "button",
  ref = $bindable(null),
  href = undefined,
  type = "button",
  disabled,
  children,
  ...restProps
}: ButtonProps = $props();

let labelProps = $derived(restProps as HTMLLabelAttributes);
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	{#if as === "label"}
		<label
			bind:this={ref}
			data-slot="button"
			class={cn(buttonVariants({ variant, size }), className)}
			aria-disabled={disabled}
			{...labelProps}
		>
			{@render children?.()}
		</label>
	{:else}
		<button
			bind:this={ref}
			data-slot="button"
			class={cn(buttonVariants({ variant, size }), className)}
			{type}
			{disabled}
			{...restProps}
		>
			{@render children?.()}
		</button>
	{/if}
{/if}
