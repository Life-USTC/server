<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import MenuIcon from "@lucide/svelte/icons/menu";
import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
import type { ShellLink } from "$lib/components/shell/types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Sheet from "$lib/components/ui/sheet/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";

export let copy: LayoutCopy;
export let links: ShellLink[];
export let isActiveLink: (link: ShellLink) => boolean;

let open = false;

$: currentLink = links.find((link) => isActiveLink(link)) ?? links[0];
</script>

<Sheet.Root bind:open>
  <nav
    aria-label={copy.nav.groups.adminTools}
    class="bg-card/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    data-shell-navigation="admin-mobile"
    data-testid="admin-mobile-navigation"
  >
    <div class="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-2 px-3">
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-label={copy.nav.groups.adminTools}
            class="min-w-0 flex-1 justify-start gap-2"
            data-testid="admin-mobile-navigation-trigger"
            type="button"
            variant="ghost"
          >
            <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
            <span class="truncate">{copy.nav.groups.adminTools}</span>
            <MenuIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        {/snippet}
      </Sheet.Trigger>

      {#if currentLink}
        {@const CurrentIcon = currentLink.icon}
        <div
          aria-current="page"
          class="flex min-w-0 max-w-[48%] items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium"
          data-testid="admin-mobile-navigation-current"
          title={currentLink.label}
        >
          {#if CurrentIcon}
            <CurrentIcon aria-hidden="true" data-icon="inline-start" />
          {/if}
          <span class="truncate">{currentLink.label}</span>
        </div>
      {/if}
    </div>
  </nav>

  <Sheet.Content
    class="max-h-[min(80dvh,32rem)] overflow-y-auto p-0"
    data-testid="admin-mobile-navigation-panel"
    side="bottom"
  >
    <Sheet.Header class="border-b pr-12">
      <Sheet.Title>{copy.nav.groups.adminTools}</Sheet.Title>
      <Sheet.Description>{copy.nav.admin.title}</Sheet.Description>
    </Sheet.Header>

    <Item.Group class="gap-0 px-4 pb-4">
      {#each links as link, index (link.href)}
        {@const active = isActiveLink(link)}
        {@const Icon = link.icon}
        <Item.Root
          class="px-0 py-1.5"
          data-active={active}
          variant={active ? "muted" : "default"}
        >
          <a
            aria-current={active ? "page" : undefined}
            class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            href={link.href}
            onclick={() => (open = false)}
          >
            {#if Icon}
              <Icon aria-hidden="true" data-icon="inline-start" />
            {/if}
            <span class="min-w-0 flex-1 truncate">{link.label}</span>
            <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </Item.Root>
        {#if index < links.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  </Sheet.Content>
</Sheet.Root>
