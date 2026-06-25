<script lang="ts">
import * as Menu from "$lib/components/ui/menu/index.js";
import type { ShellCopy, ShellLink } from "./types";

export let closeMenus: () => void;
export let copy: ShellCopy;
export let mobileMenuOpen: boolean;
export let primaryLinks: ShellLink[];
export let setMobileMenuOpen: (open: boolean) => void;
</script>

<div class="relative sm:hidden">
  <Menu.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
    <Menu.Trigger size="sm" variant="ghost">
      {copy.shell.menu}
    </Menu.Trigger>
    <Menu.Content align="end" class="w-44">
      {#each primaryLinks as link}
        <Menu.Item href={link.href} onclick={closeMenus}>
          {link.label}
        </Menu.Item>
      {/each}
    </Menu.Content>
  </Menu.Root>
</div>
