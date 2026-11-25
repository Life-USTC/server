<script lang="ts">
	import { Textarea } from "@ui-sdk/svelte/textarea";
	import { cn, type WithElementRef, type WithoutChildren } from "#lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<Textarea
	{@attach (element: HTMLTextAreaElement) => { ref = element; return () => { ref = null; }; }}
	class={cn(
		"border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-1.5 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{...restProps}
  defaultValue={restProps.defaultValue == null ? undefined : String(restProps.defaultValue)}
  disabled={restProps.disabled ?? false}
  required={restProps.required ?? false}
  bind:value={() => value == null ? "" : String(value), (next) => { value = next; }}
>
    {#snippet render({ props })}
      <textarea {...props} data-slot={dataSlot} {value}></textarea>
    {/snippet}
</Textarea>
