<script lang="ts" module>
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

	export type ToggleVariant = VariantProps<typeof toggleVariants>["variant"];
	export type ToggleSize = VariantProps<typeof toggleVariants>["size"];
	export type ToggleVariants = VariantProps<typeof toggleVariants>;
</script>

<script lang="ts">
	import { Toggle } from "@ui-sdk/svelte/toggle";
	import type { ComponentProps } from "svelte";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		pressed = $bindable(false),
		class: className,
		size = "default",
		variant = "default",
		...restProps
	}: ComponentProps<typeof Toggle> & { ref?: HTMLButtonElement | null } & {
		variant?: ToggleVariant;
		size?: ToggleSize;
	} = $props();
</script>

<Toggle
	{@attach (element: HTMLButtonElement) => { ref = element; return () => { ref = null; }; }}
	bind:pressed
	data-slot="toggle"
	class={cn(toggleVariants({ variant, size }), className)}
	{...restProps}
/>
