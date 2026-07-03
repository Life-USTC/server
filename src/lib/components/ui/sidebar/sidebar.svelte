<script lang="ts">
import { onDestroy } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import * as Sheet from "$lib/components/ui/sheet/index.js";
import { cn, type WithElementRef } from "$lib/utils.js";
import { SIDEBAR_WIDTH_MOBILE } from "./constants.js";
import { useSidebar as getSidebar } from "./context.svelte.js";

type SidebarElement = "div" | "aside";
const HOVER_PREVIEW_DELAY_MS = 350;

let {
  ref = $bindable(null),
  as = "div",
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  position = "fixed",
  desktopBreakpoint = "md",
  mobileMode = position === "static" ? "inline" : "sheet",
  hoverPreview = false,
  class: className,
  children,
  ...restProps
}: WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
  as?: SidebarElement;
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  position?: "fixed" | "static";
  desktopBreakpoint?: "md" | "lg";
  mobileMode?: "inline" | "sheet";
  hoverPreview?: boolean;
} = $props();

const sidebar = getSidebar();
let hoverPreviewTimeout: ReturnType<typeof setTimeout> | undefined;
let dataState = $derived(
  position === "static" && sidebar.isMobile ? "expanded" : sidebar.state,
);
let dataCollapsible = $derived(dataState === "collapsed" ? collapsible : "");

function clearHoverPreviewTimeout() {
  if (hoverPreviewTimeout) {
    clearTimeout(hoverPreviewTimeout);
    hoverPreviewTimeout = undefined;
  }
}

function setPreviewOpen(value: boolean) {
  if (hoverPreview && collapsible === "icon") {
    sidebar.setPreviewOpen(value);
  }
}

function handleMouseEnter(event: MouseEvent) {
  event.stopPropagation();
  if (!hoverPreview || collapsible !== "icon") return;

  clearHoverPreviewTimeout();
  hoverPreviewTimeout = setTimeout(() => {
    setPreviewOpen(true);
    hoverPreviewTimeout = undefined;
  }, HOVER_PREVIEW_DELAY_MS);
}

function handleMouseLeave(event: MouseEvent) {
  event.stopPropagation();
  clearHoverPreviewTimeout();
  setPreviewOpen(false);
}

onDestroy(clearHoverPreviewTimeout);
</script>

{#if collapsible === "none"}
	<svelte:element
		this={as}
		class={cn(
			"bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</svelte:element>
{:else if sidebar.isMobile && mobileMode === "sheet"}
	<Sheet.Root
		bind:open={() => sidebar.openMobile, (v) => sidebar.setOpenMobile(v)}
		{...restProps}
	>
		<Sheet.Content
			bind:ref
			data-sidebar="sidebar"
			data-slot="sidebar"
			data-mobile="true"
			class={cn(
				"bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden",
				className
			)}
			style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
			{side}
		>
			<Sheet.Header class="sr-only">
				<Sheet.Title>Sidebar</Sheet.Title>
				<Sheet.Description>Displays the mobile sidebar.</Sheet.Description>
			</Sheet.Header>
			<div class="flex h-full w-full flex-col">
				{@render children?.()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else if position === "static"}
	<svelte:element
		this={as}
		bind:this={ref}
		class={cn(
			"text-sidebar-foreground group flex h-full min-h-0 w-full shrink-0 transition-[width] duration-200 ease-linear",
			desktopBreakpoint === "lg" ? "lg:w-(--sidebar-width)" : "md:w-(--sidebar-width)",
			variant === "floating" || variant === "inset"
				? desktopBreakpoint === "lg"
					? "lg:data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
					: "md:data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
				: desktopBreakpoint === "lg"
					? "lg:data-[collapsible=icon]:w-(--sidebar-width-icon)"
					: "md:data-[collapsible=icon]:w-(--sidebar-width-icon)"
		)}
		data-state={dataState}
		data-collapsible={dataCollapsible}
		data-variant={variant}
		data-side={side}
		data-slot="sidebar"
		role="presentation"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<div
			data-slot="sidebar-container"
			class={cn(
				"flex h-full min-h-0 w-full",
				variant === "floating" || variant === "inset" ? "p-2" : "",
				className
			)}
			{...restProps}
		>
			<div
				data-sidebar="sidebar"
				data-slot="sidebar-inner"
				class="bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full min-h-0 flex-col"
			>
				{@render children?.()}
			</div>
		</div>
	</svelte:element>
{:else}
	<svelte:element
		this={as}
		bind:this={ref}
		class={cn("text-sidebar-foreground group peer", desktopBreakpoint === "lg" ? "hidden lg:block" : "hidden md:block")}
		data-state={sidebar.state}
		data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
		data-variant={variant}
		data-side={side}
		data-slot="sidebar"
		role="presentation"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
	>
		<!-- This is what handles the sidebar gap on desktop -->
		<div
			data-slot="sidebar-gap"
			class={cn(
				"transition-[width] duration-200 ease-linear relative w-(--sidebar-width) bg-transparent",
				"group-data-[collapsible=offcanvas]:w-0",
				"group-data-[side=right]:rotate-180",
				variant === "floating" || variant === "inset"
					? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
					: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
			)}
		></div>
		<div
			data-slot="sidebar-container"
			class={cn(
				"fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear",
				desktopBreakpoint === "lg" ? "lg:flex" : "md:flex",
				side === "left"
					? "start-0 group-data-[collapsible=offcanvas]:start-[calc(var(--sidebar-width)*-1)]"
					: "end-0 group-data-[collapsible=offcanvas]:end-[calc(var(--sidebar-width)*-1)]",
				// Adjust the padding for floating and inset variants.
				variant === "floating" || variant === "inset"
					? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
					: "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-e group-data-[side=right]:border-s",
				className
			)}
			{...restProps}
		>
			<div
				data-sidebar="sidebar"
				data-slot="sidebar-inner"
				class="bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full flex-col"
			>
				{@render children?.()}
			</div>
		</div>
	</svelte:element>
{/if}
