<script lang="ts">
import type { HTMLAttributes } from "svelte/elements";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { cn, type WithElementRef } from "$lib/utils.js";
import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
} from "./constants.js";
import { setSidebar } from "./context.svelte.js";

let {
  ref = $bindable(null),
  open = $bindable(true),
  onOpenChange = () => {},
  layout = "root",
  persistCookie,
  enableKeyboardShortcut,
  mobileBreakpoint,
  class: className,
  style,
  children,
  ...restProps
}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  layout?: "root" | "contained";
  persistCookie?: boolean;
  enableKeyboardShortcut?: boolean;
  mobileBreakpoint?: number;
} = $props();

let shouldPersistCookie = $derived(persistCookie ?? layout === "root");
let shouldEnableKeyboardShortcut = $derived(
  enableKeyboardShortcut ?? layout === "root",
);

const sidebar = setSidebar({
  open: () => open,
  setOpen: (value: boolean) => {
    open = value;
    onOpenChange(value);

    if (shouldPersistCookie) {
      // This sets the cookie to keep the sidebar state.
      // biome-ignore lint/suspicious/noDocumentCookie: Matches shadcn sidebar persistence.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    }
  },
  mobileBreakpoint: () => mobileBreakpoint,
});

function handleShortcutKeydown(event: KeyboardEvent) {
  if (shouldEnableKeyboardShortcut) {
    sidebar.handleShortcutKeydown(event);
  }
}
</script>

<svelte:window onkeydown={handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {style}"
		class={cn(
			"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar w-full",
			layout === "root" ? "flex min-h-svh" : "block min-h-0",
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>
