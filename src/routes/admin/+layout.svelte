<script lang="ts">
import Bus from "@lucide/svelte/icons/bus";
import Gavel from "@lucide/svelte/icons/gavel";
import KeyRound from "@lucide/svelte/icons/key-round";
import Shield from "@lucide/svelte/icons/shield";
import Users from "@lucide/svelte/icons/users";
import { tick } from "svelte";
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button/index.js";
import type { LayoutData } from "./$types";

export let data: LayoutData;

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

function revealActive(node: HTMLElement, active: boolean) {
  function reveal(isCurrent: boolean) {
    if (!isCurrent) return;
    void tick().then(() => {
      if (!navigation) return;
      const navigationBox = navigation.getBoundingClientRect();
      const nodeBox = node.getBoundingClientRect();
      navigation.scrollLeft +=
        nodeBox.left +
        nodeBox.width / 2 -
        (navigationBox.left + navigationBox.width / 2);
    });
  }

  reveal(active);
  return { update: reveal };
}
</script>

{#if data.user?.isAdmin}
  <section
    class="grid min-w-0 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-6"
    data-testid="admin-layout"
  >
    <nav
      aria-label={data.copy.nav.groups.adminTools}
      bind:this={navigation}
      class="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:sticky lg:top-4 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
      data-testid="admin-navigation"
    >
      <ul class="flex min-w-max gap-2 pr-4 lg:grid lg:min-w-0 lg:pr-0">
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

    <div class="min-w-0" data-testid="admin-active-panel">
      <slot />
    </div>
  </section>
{:else}
  <slot />
{/if}
