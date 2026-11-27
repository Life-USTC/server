<script lang="ts">
	import { FieldDescription } from "@ui-sdk/svelte/field";
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLParagraphElement>> = $props();
</script>

<FieldDescription
	{@attach (element: HTMLParagraphElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="field-description"
	class={cn(
		"text-muted-foreground text-left text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
		"last:mt-0 nth-last-2:-mt-1",
		"[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</FieldDescription>
