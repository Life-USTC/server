<script lang="ts">
import { type Component, onMount, tick } from "svelte";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
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

let canScrollLeft = false;
let canScrollRight = false;
let leftOpaqueWidth = 0;
let scrollViewport: HTMLElement | null = null;

function updateOverflow() {
  if (!scrollViewport) return;
  const viewportBox = scrollViewport.getBoundingClientRect();
  const clippedContent = Array.from(
    scrollViewport.querySelectorAll<HTMLElement>(
      '[data-sidebar="menu-item"] a > svg, [data-sidebar="menu-item"] a > span',
    ),
  )
    .map((node) => node.getBoundingClientRect())
    .filter(
      (nodeBox) =>
        nodeBox.left < viewportBox.left && nodeBox.right > viewportBox.left,
    );
  canScrollLeft = scrollViewport.scrollLeft > 1;
  canScrollRight =
    scrollViewport.scrollLeft + scrollViewport.clientWidth <
    scrollViewport.scrollWidth - 1;
  leftOpaqueWidth = Math.ceil(
    Math.max(
      0,
      ...clippedContent.map((nodeBox) => nodeBox.right - viewportBox.left),
    ),
  );
}

function revealActive(node: HTMLElement, active: boolean) {
  function reveal(isActive: boolean) {
    if (isActive) {
      void tick().then(() => {
        if (!scrollViewport) return;
        const viewportBox = scrollViewport.getBoundingClientRect();
        const nodeBox = node.getBoundingClientRect();
        scrollViewport.scrollLeft +=
          nodeBox.left +
          nodeBox.width / 2 -
          (viewportBox.left + viewportBox.width / 2);
        updateOverflow();
      });
    }
  }

  reveal(active);
  return { update: reveal };
}

onMount(() => {
  if (!scrollViewport) return;
  const viewport = scrollViewport;
  const resizeObserver = new ResizeObserver(updateOverflow);
  resizeObserver.observe(viewport);
  viewport.addEventListener("scroll", updateOverflow, { passive: true });
  void tick().then(updateOverflow);

  return () => {
    resizeObserver.disconnect();
    viewport.removeEventListener("scroll", updateOverflow);
  };
});
</script>

<div class="min-w-0" style="--sidebar-width: 14rem;">
  <Sidebar.Root
    collapsible="none"
    class={cn(
      "relative w-full border-sidebar-border border-b lg:w-(--sidebar-width) lg:border-e lg:border-b-0",
      canScrollLeft &&
        "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-(--detail-nav-left-fade) before:bg-[linear-gradient(to_right,var(--sidebar)_0,var(--sidebar)_var(--detail-nav-left-opaque),transparent_100%)] lg:before:hidden",
      canScrollRight &&
        "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:bg-gradient-to-l after:from-sidebar after:to-transparent lg:after:hidden",
    )}
    data-overflow-left={canScrollLeft}
    data-overflow-right={canScrollRight}
    data-testid="detail-section-nav"
    style={`--detail-nav-left-fade: ${leftOpaqueWidth + 8}px; --detail-nav-left-opaque: ${leftOpaqueWidth}px;`}
  >
    <Sidebar.Content
      aria-label={ariaLabel || label}
      bind:ref={scrollViewport}
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
