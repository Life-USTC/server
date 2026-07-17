<script lang="ts">
import type { Component } from "svelte";
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
</script>

<div class="min-w-0" style="--sidebar-width: 14rem;">
  <Sidebar.Root
    collapsible="none"
    class="w-full border-sidebar-border border-b lg:w-(--sidebar-width) lg:border-e lg:border-b-0"
    data-testid="detail-section-nav"
  >
    <Sidebar.Content
      aria-label={ariaLabel || label}
      class="overflow-x-auto overflow-y-hidden lg:overflow-x-hidden lg:overflow-y-auto"
    >
      <Sidebar.Group>
        {#if label}
          <Sidebar.GroupLabel class="hidden lg:flex">{label}</Sidebar.GroupLabel>
        {/if}
        <Sidebar.GroupContent>
          <Sidebar.Menu class="w-max min-w-full flex-row lg:w-full lg:min-w-0 lg:flex-col">
            {#each items as item}
              {@const active = item.href === activeHref}
              <Sidebar.MenuItem class="shrink-0">
                <Sidebar.MenuButton isActive={active}>
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
  </Sidebar.Root>
</div>
