<script lang="ts">
import type { Component } from "svelte";
import { onMount } from "svelte";
import {
  loadSecondarySidebarCollapsed,
  setSecondarySidebarCollapsed,
} from "$lib/components/sidebar-collapse";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";

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
  style="--sidebar-width: 14rem; --sidebar-width-icon: 3.5rem;"
  class="h-full w-full lg:w-auto"
>
  <Sidebar.Root
    position="static"
    collapsible="icon"
    desktopBreakpoint="lg"
    hoverPreview
    class="border-sidebar-border bg-sidebar border-b lg:border-e lg:border-b-0"
    data-testid="detail-section-nav"
  >
    <Sidebar.Content class="p-2 lg:p-3" aria-label={ariaLabel || label}>
      <Sidebar.Group class="p-0">
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each items as item}
              {@const active = item.href === activeHref}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  class="h-10 px-2.5"
                  isActive={active}
                  tooltipContent={item.label}
                >
                  {#snippet child({ props })}
                    <a
                      {...props}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      {#if item.icon}
                        <svelte:component this={item.icon} />
                      {/if}
                      <span>{item.label}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
                {#if item.meta !== undefined && item.meta !== ""}
                  <Sidebar.MenuBadge>
                    {item.meta}
                  </Sidebar.MenuBadge>
                {/if}
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer class="pointer-events-none hidden border-sidebar-border border-t lg:flex group-data-[collapsible=icon]:items-center">
      <Sidebar.Trigger
        class="pointer-events-auto self-end group-data-[collapsible=icon]:self-center"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      />
    </Sidebar.Footer>
    <Sidebar.Rail class="max-lg:hidden" />
  </Sidebar.Root>
</Sidebar.Provider>
