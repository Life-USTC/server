<script lang="ts">
	import { cn } from "#lib/utils.js";
	import { MenuContent } from "@ui-sdk/svelte/menu";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = "start",
		class: className,
		...restProps
	}: ComponentProps<typeof MenuContent> & { ref?: HTMLElement | null } = $props();
</script>

<MenuContent
	container={typeof document === "undefined" ? undefined : document.body}
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="dropdown-menu-content"
	{sideOffset}
	{align}
	class={cn(
		"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-xl p-1 shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 z-50 w-(--anchor-width) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden",
		className
	)}
	{...restProps}
/>
