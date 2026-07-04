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

<Sidebar.Root
  collapsible="none"
  style="--sidebar-width: 14rem;"
  class="w-full border-sidebar-border border-b bg-sidebar lg:w-(--sidebar-width) lg:border-e lg:border-b-0"
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
</Sidebar.Root>
