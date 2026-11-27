<script lang="ts">
	import { AlertDialogBackdrop, AlertDialogContent } from "@ui-sdk/svelte/alert-dialog";

	import { cn } from "#lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		size = "default",
		...restProps
	}: ComponentProps<typeof AlertDialogContent> & { ref?: HTMLElement | null } & {
		size?: "default" | "sm";
	} = $props();
</script>

<AlertDialogBackdrop class="data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-100" />
<AlertDialogContent
	container={typeof document === "undefined" ? undefined : document.body}
	{@attach (element: HTMLElement) => { ref = element; return () => { ref = null; }; }}
	data-slot="alert-dialog-content"
	data-size={size}
	class={cn(
		"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 ring-1 outline-none duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs group/alert-dialog-content data-[size=default]:sm:max-w-sm",
		className
	)}
	{...restProps}
/>
