<script lang="ts">
	import { Checkbox } from "@ui-sdk/svelte/checkbox";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { cn } from "#lib/utils.js";
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: className,
		onCheckedChange,
		...restProps
	}: HTMLButtonAttributes & { disabled?: boolean; name?: string; form?: string; value?: string;
    ref?: HTMLButtonElement | null;
    checked?: boolean;
    indeterminate?: boolean;
    required?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } = $props();
</script>

<Checkbox
	{@attach (element: HTMLButtonElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="checkbox"
	class={cn(
		"border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-sm border transition-colors group-has-disabled/field:opacity-50 focus-visible:ring-3 aria-invalid:ring-3 peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	checked={indeterminate ? "indeterminate" : checked}
  onCheckedChange={(next) => {
    indeterminate = next === "indeterminate";
    checked = next === true;
    onCheckedChange?.(checked);
  }}
	{...restProps}
>
	{#snippet children()}
		<div
			data-slot="checkbox-indicator"
			class="[&>svg]:size-3.5 grid place-content-center text-current transition-none"
		>
			{#if checked && !indeterminate}
				<CheckIcon  />
			{:else if indeterminate}
				<MinusIcon  />
			{/if}
		</div>
	{/snippet}
</Checkbox>
