<script lang="ts">
import MenuIcon from "@lucide/svelte/icons/menu";
import * as Menu from "$lib/components/ui/menu/index.js";
import { cn } from "$lib/utils.js";
import type { ShellCopy, ShellLink, ShellNavGroup } from "./types";

export let closeMenus: () => void;
export let copy: ShellCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let mobileMenuOpen: boolean;
export let navGroups: ShellNavGroup[];
export let setMobileMenuOpen: (open: boolean) => void;
</script>

<div class="relative lg:hidden">
  <Menu.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
    <Menu.Trigger aria-label={copy.shell.menu} size="icon-sm" variant="outline">
      <MenuIcon data-icon="inline-start" />
    </Menu.Trigger>
    <Menu.Content align="start" class="max-h-[min(34rem,calc(100vh-5rem))] w-64 overflow-y-auto">
      {#each navGroups as group}
        <div class="px-2 pt-2 pb-1 font-medium text-base-content/50 text-xs uppercase tracking-normal" role="presentation">
          {group.label}
        </div>
        {#each group.links as link}
          {@const active = isActiveLink(link)}
          <Menu.Item
            class={cn(active && "bg-base-200 font-medium text-base-content")}
            href={link.href}
            onclick={closeMenus}
          >
            {#if link.icon}
              <span class="shell-mobile-menu-icon" aria-hidden="true">
                <svelte:component this={link.icon} />
              </span>
            {/if}
            {link.label}
          </Menu.Item>
      {/each}
      {/each}
    </Menu.Content>
  </Menu.Root>
</div>

<style>
  .shell-mobile-menu-icon :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
