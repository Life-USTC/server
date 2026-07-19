<script lang="ts">
import { type Component, tick } from "svelte";
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

function revealActive(node: HTMLElement, active: boolean) {
  function reveal(isActive: boolean) {
    if (isActive) {
      void tick().then(() =>
        node.scrollIntoView({ block: "nearest", inline: "center" }),
      );
    }
  }

  reveal(active);
  return { update: reveal };
}
</script>

<div class="min-w-0" style="--sidebar-width: 14rem;">
  <Sidebar.Root
    collapsible="none"
    class="relative w-full border-sidebar-border border-b after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:bg-gradient-to-l after:from-sidebar after:to-transparent lg:w-(--sidebar-width) lg:border-e lg:border-b-0 lg:after:hidden"
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
          <Sidebar.Menu class="w-max min-w-full flex-row pr-8 lg:w-full lg:min-w-0 lg:flex-col lg:pr-0">
            {#each items as item}
              {@const active = item.href === activeHref}
              <Sidebar.MenuItem class="shrink-0">
                <Sidebar.MenuButton isActive={active}>
                  {#snippet child({ props })}
                    <a
                      {...props}
                      use:revealActive={active}
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
