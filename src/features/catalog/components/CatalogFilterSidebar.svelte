<script lang="ts">
import type { Component } from "svelte";
import { onMount } from "svelte";
import {
  loadSecondarySidebarCollapsed,
  setSecondarySidebarCollapsed,
} from "$lib/components/sidebar-collapse";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";

export let activeCount = 0;
export let description = "";
export let icon: Component | undefined = undefined;
export let title: string;

let collapsed = false;

function setOpen(open: boolean) {
  collapsed = setSecondarySidebarCollapsed(!open);
}

onMount(() => {
  collapsed = loadSecondarySidebarCollapsed(collapsed);
});
</script>

<Sidebar.Provider
  bind:open={() => !collapsed, setOpen}
  layout="contained"
  mobileBreakpoint={1024}
  style="--sidebar-width: 17rem; --sidebar-width-icon: 3.5rem;"
  class="w-full lg:w-auto"
>
  <Sidebar.Root
    position="static"
    collapsible="icon"
    desktopBreakpoint="lg"
    hoverPreview
    class="border-sidebar-border bg-sidebar border-b lg:sticky lg:top-12 lg:h-[calc(100vh-10.75rem)] lg:border-e lg:border-b-0"
    data-testid="catalog-filter-sidebar"
  >
    <Sidebar.Header class="border-sidebar-border border-b p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
      <div class="flex min-w-0 items-start justify-between gap-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
        <div class="flex min-w-0 gap-2 group-data-[collapsible=icon]:justify-center">
          {#if icon}
            <span
              class="mt-0.5 flex shrink-0 items-center justify-center text-sidebar-foreground/60 [&_svg]:size-4"
              aria-hidden="true"
            >
              <svelte:component this={icon} />
            </span>
          {/if}
          <div class="min-w-0 group-data-[collapsible=icon]:hidden">
            <p class="font-medium text-sidebar-foreground text-sm">{title}</p>
            {#if description}
              <p class="mt-0.5 text-sidebar-foreground/60 text-xs">{description}</p>
            {/if}
          </div>
        </div>
        {#if activeCount > 0}
          <Badge class="shrink-0" variant="secondary">{activeCount}</Badge>
        {/if}
      </div>
    </Sidebar.Header>

    <Sidebar.Content class="p-3">
      <div class="group-data-[collapsible=icon]:hidden">
        <slot />
      </div>
    </Sidebar.Content>

    <Sidebar.Footer class="pointer-events-none hidden border-sidebar-border border-t lg:flex group-data-[collapsible=icon]:items-center">
      <Sidebar.Trigger
        class="pointer-events-auto self-end group-data-[collapsible=icon]:self-center"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      />
    </Sidebar.Footer>
  </Sidebar.Root>
</Sidebar.Provider>
