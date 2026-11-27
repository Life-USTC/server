<script lang="ts">
	import { FieldSet } from "@ui-sdk/svelte/field";
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLFieldsetAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLFieldsetAttributes> = $props();
</script>

<FieldSet
	{@attach (element: HTMLFieldSetElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="field-set"
	class={cn("gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3 flex flex-col", className)}
	{...restProps}
	disabled={restProps.disabled ?? false}
>
	{@render children?.()}
</FieldSet>
