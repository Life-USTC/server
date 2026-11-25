<script lang="ts">
	import { DialogClose, DialogContent } from "@ui-sdk/svelte/dialog";
	import type { Snippet } from "svelte";
	import * as Dialog from "./index.js";
	import { cn } from "#lib/utils.js";
	import type { ComponentProps } from "svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import XIcon from '@lucide/svelte/icons/x';

	let {
		ref = $bindable(null),
		class: className,
		children,
		showCloseButton = true,
		...restProps
	}: ComponentProps<typeof DialogContent> & { ref?: HTMLElement | null } & {
		children: Snippet;
		showCloseButton?: boolean;
	} = $props();
</script>

<Dialog.Overlay />
<DialogContent
	container={typeof document === "undefined" ? undefined : document.body}
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="dialog-content"
	class={cn(
		"bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 text-sm ring-1 outline-none duration-100 sm:max-w-sm",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	{#if showCloseButton}
		<DialogClose data-slot="dialog-close">
			{#snippet render({ props })}
				<Button
					variant="ghost"
					class="absolute top-2 right-2"
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
