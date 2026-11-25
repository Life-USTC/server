<script lang="ts" module>
	export type Side = "top" | "right" | "bottom" | "left";
</script>

<script lang="ts">
	import { DialogClose, DialogContent } from "@ui-sdk/svelte/dialog";
	import type { Snippet } from "svelte";
	import SheetOverlay from "./sheet-overlay.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import XIcon from '@lucide/svelte/icons/x';
	import { cn } from "#lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		side = "right",
		showCloseButton = true,
		children,
		...restProps
	}: ComponentProps<typeof DialogContent> & { ref?: HTMLElement | null } & {
		side?: Side;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<SheetOverlay />
<DialogContent
	container={typeof document === "undefined" ? undefined : document.body}
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="sheet-content"
	data-side={side}
	class={cn(
		"bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	{#if showCloseButton}
		<DialogClose data-slot="sheet-close">
			{#snippet render({ props })}
				<Button
					variant="ghost"
					class="absolute top-3 right-3"
					size="icon-sm"
					aria-label="Close"
					{...props}
				>
					<XIcon />
				</Button>
			{/snippet}
		</DialogClose>
	{/if}
</DialogContent>
