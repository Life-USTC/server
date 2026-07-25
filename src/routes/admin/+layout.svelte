<script lang="ts">
import Bus from "@lucide/svelte/icons/bus";
import Gavel from "@lucide/svelte/icons/gavel";
import KeyRound from "@lucide/svelte/icons/key-round";
import Shield from "@lucide/svelte/icons/shield";
import Users from "@lucide/svelte/icons/users";
import { onMount, tick } from "svelte";
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button/index.js";
import { cn } from "$lib/utils.js";
import type { LayoutData } from "./$types";

export let data: LayoutData;

let canScrollNavLeft = false;
let canScrollNavRight = false;
let navigation: HTMLElement | null = null;

$: pathname = $page.url.pathname;
$: links = [
  {
    href: "/admin",
    icon: Shield,
    label: data.copy.nav.admin.title,
  },
  {
    href: "/admin/users",
    icon: Users,
    label: data.copy.nav.admin.users,
  },
  {
    href: "/admin/moderation",
    icon: Gavel,
    label: data.copy.nav.admin.moderation,
  },
  {
    href: "/admin/oauth",
    icon: KeyRound,
    label: data.copy.nav.admin.oauth,
  },
  {
    href: "/admin/bus",
    icon: Bus,
    label: data.copy.nav.admin.bus,
  },
];

function isActive(href: string, currentPathname: string) {
  return href === "/admin"
    ? currentPathname === href
    : currentPathname === href || currentPathname.startsWith(`${href}/`);
}

function centerNavigationItem(node: HTMLElement) {
  if (!navigation) return;
  const navigationBox = navigation.getBoundingClientRect();
  const nodeBox = node.getBoundingClientRect();
  navigation.scrollLeft +=
    nodeBox.left +
    nodeBox.width / 2 -
    (navigationBox.left + navigationBox.width / 2);
  updateNavigationOverflow();
}

function revealActive(node: HTMLElement, active: boolean) {
  function reveal(isCurrent: boolean) {
    if (!isCurrent) return;
    void tick().then(() => centerNavigationItem(node));
  }

  reveal(active);
  return { update: reveal };
}

function updateNavigationOverflow() {
  if (!navigation) return;
  canScrollNavLeft = navigation.scrollLeft > 1;
  canScrollNavRight =
    navigation.scrollLeft + navigation.clientWidth < navigation.scrollWidth - 1;
}

onMount(() => {
  if (!navigation) return;
  const nav = navigation;
  const resizeObserver = new ResizeObserver(updateNavigationOverflow);
  resizeObserver.observe(nav);
  nav.addEventListener("scroll", updateNavigationOverflow, { passive: true });
  void tick().then(() => {
    const activeLink = nav.querySelector<HTMLElement>('a[aria-current="page"]');
    if (activeLink) centerNavigationItem(activeLink);
    else updateNavigationOverflow();
  });

  return () => {
    resizeObserver.disconnect();
    nav.removeEventListener("scroll", updateNavigationOverflow);
  };
});
</script>

{#if data.user?.isAdmin}
  <section
    class="grid min-w-0 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-6"
    data-testid="admin-layout"
  >
    <div
      class={cn(
        "relative -mx-4 min-w-0 sm:-mx-5 lg:sticky lg:top-4 lg:mx-0",
        canScrollNavLeft &&
          "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-8 before:bg-gradient-to-r before:from-background before:to-transparent lg:before:hidden",
        canScrollNavRight &&
          "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:bg-gradient-to-l after:from-background after:to-transparent lg:after:hidden",
      )}
      data-overflow-left={canScrollNavLeft}
      data-overflow-right={canScrollNavRight}
    >
      <nav
        aria-label={data.copy.nav.groups.adminTools}
        bind:this={navigation}
        class="overflow-x-auto px-4 pb-1 sm:px-5 lg:overflow-visible lg:px-0 lg:pb-0"
        data-testid="admin-navigation"
      >
        <ul class="flex min-w-max gap-2 pr-8 lg:grid lg:min-w-0 lg:pr-0">
          {#each links as link}
            {@const Icon = link.icon}
            {@const active = isActive(link.href, pathname)}
            <li class="lg:min-w-0" use:revealActive={active}>
              <Button
                aria-current={active ? "page" : undefined}
                class="justify-start lg:w-full"
                href={link.href}
                variant={active ? "secondary" : "ghost"}
              >
                <Icon aria-hidden="true" data-icon="inline-start" />
                {link.label}
              </Button>
            </li>
          {/each}
        </ul>
      </nav>
    </div>

    <div class="min-w-0" data-testid="admin-active-panel">
      <slot />
    </div>
  </section>
{:else}
  <slot />
{/if}
