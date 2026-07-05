<script lang="ts">
import MenuIcon from "@lucide/svelte/icons/menu";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
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
  <DropdownMenu.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          aria-label={copy.shell.menu}
          size="icon-sm"
          variant="outline"
        >
          <MenuIcon data-icon="inline-start" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="start"
      class="max-h-[min(34rem,calc(100vh-5rem))] w-64"
      preventScroll={false}
    >
      {#each navGroups as group}
        <DropdownMenu.Group>
          <DropdownMenu.Label>{group.label}</DropdownMenu.Label>
          {#each group.links as link}
            {@const active = isActiveLink(link)}
            <DropdownMenu.Item
              class={cn(active && "bg-accent font-medium text-accent-foreground")}
              onSelect={closeMenus}
            >
              {#snippet child({ props })}
                <a {...props} aria-label={link.ariaLabel} href={link.href}>
                  {#if link.icon}
                    <svelte:component this={link.icon} />
                  {/if}
                  {link.label}
                </a>
              {/snippet}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Group>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
