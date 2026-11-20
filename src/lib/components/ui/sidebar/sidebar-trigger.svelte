<script lang="ts">
	import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
	import { cn, type WithElementRef } from "#lib/utils.js";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { useSidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		class: className,
		onclick,
		children,
		...restProps
	}: WithElementRef<HTMLButtonAttributes, HTMLButtonElement> = $props();

	const sidebar = useSidebar();
</script>

<button
	bind:this={ref}
	data-sidebar="trigger"
	data-slot="sidebar-trigger"
	class={cn("inline-flex size-9 shrink-0 appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4", className)}
	aria-expanded={sidebar.isMobile ? sidebar.openMobile : sidebar.state === "expanded"}
	type="button"
	onclick={(event) => {
		onclick?.call(event.currentTarget, event);
		sidebar.toggle();
	}}
	{...restProps}
>
	{#if children}{@render children()}{:else}<PanelLeftIcon />{/if}
	<span class="sr-only">Toggle Sidebar</span>
</button>
