<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
import type { ShellCopy, ShellLink } from "./types";

export let closeMenus: () => void;
export let copy: ShellCopy;
export let mobileMenuOpen: boolean;
export let primaryLinks: ShellLink[];
export let toggleMobileMenu: () => void;
</script>

<div class="relative sm:hidden">
  <Button
    aria-expanded={mobileMenuOpen}
    aria-haspopup="menu"
    onclick={toggleMobileMenu}
    size="sm"
    type="button"
    variant="ghost"
  >
    {copy.shell.menu}
  </Button>
  {#if mobileMenuOpen}
    <Menu.Root align="right" class="w-44">
      {#each primaryLinks as link}
        <Menu.Item href={link.href} onclick={closeMenus}>
          {link.label}
        </Menu.Item>
      {/each}
    </Menu.Root>
  {/if}
</div>
