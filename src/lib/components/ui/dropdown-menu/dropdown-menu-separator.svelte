<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { MenuSeparator } from "@ui-sdk/svelte/menu";
	import { cn } from "#lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof MenuSeparator> & { ref?: HTMLElement | null } = $props();
</script>

<MenuSeparator
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="dropdown-menu-separator"
	class={cn("bg-border -mx-1 my-1 h-px", className)}
	{...restProps}
/>
