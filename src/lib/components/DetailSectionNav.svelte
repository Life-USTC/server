<script lang="ts">
import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
import type { Component } from "svelte";
import { onMount } from "svelte";
import {
  loadSecondarySidebarCollapsed,
  setSecondarySidebarCollapsed,
} from "$lib/components/sidebar-collapse";
import { Button } from "$lib/components/ui/button/index.js";
import { cn } from "$lib/utils.js";

type DetailSectionNavItem = {
  href: string;
  icon?: Component;
  label: string;
  meta?: string | number;
};

export let ariaLabel: string;
export let activeHref = "";
export let items: DetailSectionNavItem[];
export let label = "";

let collapsed = false;

function setCollapsed(nextCollapsed: boolean) {
  collapsed = setSecondarySidebarCollapsed(nextCollapsed);
}

onMount(() => {
  collapsed = loadSecondarySidebarCollapsed(collapsed);
});
</script>

<aside
  class={cn(
    "w-full shrink-0 bg-base-100 lg:h-full lg:min-h-0",
    collapsed ? "lg:w-14" : "lg:w-56",
  )}
  data-collapsed={collapsed}
  data-testid="detail-section-nav"
>
  <nav
    aria-label={ariaLabel || label}
    class={cn("h-full overflow-y-auto", collapsed ? "p-2 lg:overflow-hidden" : "p-3")}
  >
    <div class={cn("mb-2 hidden lg:flex", collapsed ? "justify-center" : "justify-end")}>
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
    <ol class="grid gap-0.5">
      {#each items as item}
        {@const active = item.href === activeHref}
        <li>
          <a
            class={cn(
              "detail-section-nav-link flex min-h-10 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm no-underline transition-colors",
              collapsed && "lg:justify-center lg:px-2",
              active
                ? "bg-base-200 font-medium text-base-content"
                : "text-base-content/70 hover:bg-base-200/70 hover:text-base-content",
            )}
            href={item.href}
            aria-label={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
          >
            <span class="flex min-w-0 items-center gap-2.5">
              {#if item.icon}
                <span class="detail-section-nav-icon" aria-hidden="true">
                  <svelte:component this={item.icon} />
                </span>
              {/if}
              <span class={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
            </span>
            {#if item.meta !== undefined && item.meta !== ""}
              <span
                class={cn(
                  "rounded-sm px-1.5 py-0.5 text-xs tabular-nums",
                  collapsed && "lg:hidden",
                  active
                    ? "bg-base-100 text-base-content/70"
                    : "bg-base-200 text-base-content/60",
                )}
              >
                {item.meta}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ol>
  </nav>
</aside>

<style>
  .detail-section-nav-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }

  .detail-section-nav-icon :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
