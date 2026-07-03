<script lang="ts">
import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
import type { Component } from "svelte";
import { onMount } from "svelte";
import {
  loadSecondarySidebarCollapsed,
  setSecondarySidebarCollapsed,
} from "$lib/components/sidebar-collapse";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { cn } from "$lib/utils.js";

export let activeCount = 0;
export let description = "";
export let icon: Component | undefined = undefined;
export let title: string;

let collapsed = false;
let hoverPreviewExpanded = false;

$: visuallyCollapsed = collapsed && !hoverPreviewExpanded;

function setCollapsed(nextCollapsed: boolean) {
  hoverPreviewExpanded = false;
  collapsed = setSecondarySidebarCollapsed(nextCollapsed);
}

onMount(() => {
  collapsed = loadSecondarySidebarCollapsed(collapsed);
});
</script>

<aside
  class={cn(
    "w-full border-base-300 border-b bg-base-100 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:sticky lg:top-12 lg:z-10 lg:flex lg:h-[calc(100vh-10.75rem)] lg:flex-col lg:border-r lg:border-b-0",
    visuallyCollapsed ? "lg:w-14" : "lg:w-[17rem]",
    collapsed && hoverPreviewExpanded && "lg:-mr-[13.5rem]",
  )}
  data-collapsed={collapsed}
  data-testid="catalog-filter-sidebar"
  onmouseenter={() => {
    hoverPreviewExpanded = true;
  }}
  onmouseleave={() => {
    hoverPreviewExpanded = false;
  }}
>
  <div class={cn("min-h-0 overflow-y-auto lg:flex-1", visuallyCollapsed ? "p-2" : "p-3")}>
    <div
      class={cn(
        "mb-4 flex items-start justify-between gap-3",
        visuallyCollapsed && "lg:mb-2 lg:flex-col lg:items-center lg:gap-2",
      )}
    >
      <div class={cn("flex min-w-0 gap-2", visuallyCollapsed && "lg:justify-center")}>
        {#if icon}
          <span class="catalog-filter-sidebar-icon mt-0.5 text-base-content/60" aria-hidden="true">
            <svelte:component this={icon} />
          </span>
        {/if}
        <div class={cn("min-w-0", visuallyCollapsed && "lg:sr-only")}>
          <p class="font-medium text-base-content text-sm">{title}</p>
          {#if description}
            <p class="mt-0.5 text-base-content/60 text-xs">{description}</p>
          {/if}
        </div>
      </div>
      {#if activeCount > 0}
        <Badge class="shrink-0" variant="secondary">{activeCount}</Badge>
      {/if}
    </div>
    <div class={cn(visuallyCollapsed && "lg:hidden")}>
      <slot />
    </div>
  </div>

  <div class={cn("hidden shrink-0 border-base-300 border-t p-2 lg:flex", visuallyCollapsed ? "justify-center" : "justify-end")}>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onclick={() => setCollapsed(!collapsed)}
    >
      {#if collapsed}
        <PanelLeftOpenIcon data-icon="inline-start" />
      {:else}
        <PanelLeftCloseIcon data-icon="inline-start" />
      {/if}
    </Button>
  </div>
</aside>

<style>
  .catalog-filter-sidebar-icon :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
