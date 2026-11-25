<script lang="ts" module>
	import { getContext, setContext } from "svelte";
	import { type VariantProps, tv } from "tailwind-variants";

	export const toggleVariants = tv({
		base: "hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-checked:bg-accent aria-checked:text-accent-foreground gap-1 rounded-lg text-sm font-medium transition-all [&_svg:not([class*='size-'])]:size-4 group/toggle hover:bg-muted inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap outline-none focus-visible:ring-[3px] md:min-h-0 md:min-w-0 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "border-input hover:bg-muted border bg-transparent",
			},
			size: {
				default: "h-8 min-w-8 md:min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				sm: "h-7 min-w-7 md:min-w-7 px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-9 min-w-9 md:min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ToggleVariants = VariantProps<typeof toggleVariants>;

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
