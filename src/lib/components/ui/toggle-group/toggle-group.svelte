<script lang="ts" module>
	import { getContext, setContext } from "svelte";
	import type { VariantProps } from "tailwind-variants";
	import { toggleVariants } from "#lib/components/ui/toggle/index.js";

	type ToggleVariants = VariantProps<typeof toggleVariants>;

	interface ToggleGroupContext extends ToggleVariants {
		spacing?: number;
		orientation?: "horizontal" | "vertical";
	}

	export function setToggleGroupCtx(props: ToggleGroupContext) {
		setContext("toggleGroup", props);
	}

	export function getToggleGroupCtx() {
		return getContext<Required<ToggleGroupContext>>("toggleGroup");
	}
</script>

<script lang="ts">
	import { ToggleGroup } from "@ui-sdk/svelte/toggle";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		value = $bindable(""),
		onValueChange,
		required = false,
		class: className,
		size = "default",
		spacing = 0,
		orientation = "horizontal",
		variant = "default",
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { ref?: HTMLDivElement | null; value?: string; onValueChange?: (value: string) => void; disabled?: boolean } &
		ToggleVariants & {
			spacing?: number;
			orientation?: "horizontal" | "vertical";
			/**
			 * Whether the group always has a selection. A single group otherwise
			 * clears itself when the selected item is clicked again, leaving no
			 * button selected above whatever that selection still filters.
			 */
			required?: boolean;
		} = $props();

	setToggleGroupCtx({
		get variant() {
			return variant;
		},
		get size() {
			return size;
		},
		get spacing() {
			return spacing;
		},
		get orientation() {
			return orientation;
		},
	});
</script>

<ToggleGroup
	value={value ? [value] : []}
  deselectable={!required}
  onValueChange={(values) => {
    value = values[0] ?? "";
    onValueChange?.(value);
  }}
	{@attach (element: HTMLDivElement) => { ref = element; return () => { ref = null; }; }}
	{orientation}
	data-slot="toggle-group"
	data-variant={variant}
	data-size={size}
	data-spacing={spacing}
	style={`--gap: ${spacing}`}
	class={cn(
		"rounded-lg group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch",
		className
	)}
	{...restProps}
/>
