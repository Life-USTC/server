<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
import type { ShellCopy, ShellUser } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: ShellCopy;
export let profileHref: string;
export let toggleUserMenu: () => void;
export let user: ShellUser;
export let userMenuOpen: boolean;
</script>

{#if user}
  <div id="app-user-menu" class="relative">
    <Button
      aria-expanded={userMenuOpen}
      aria-haspopup="menu"
      aria-label={copy.shell.profileMenu}
      class="overflow-hidden"
      onclick={toggleUserMenu}
      size="icon"
      type="button"
      variant="outline"
    >
      {#if user.image}
        <img
          class="h-6 w-6 rounded-full"
          src={user.image}
          alt={user.name ?? copy.shell.profileMenu}
        />
      {:else}
        <span>{avatarFallback}</span>
      {/if}
    </Button>
    {#if userMenuOpen}
      <Menu.Root align="right" class="w-44">
        <Menu.Item href="/" onclick={closeMenus}>
          {copy.menu.home}
        </Menu.Item>
        <Menu.Item href={profileHref} onclick={closeMenus}>
          {copy.menu.me}
        </Menu.Item>
        <Menu.Item href="/settings/profile" onclick={closeMenus}>
          {copy.menu.settings}
        </Menu.Item>
        <form method="POST" action="/signout">
          <button
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-base-200"
            role="menuitem"
            type="submit"
          >
            {copy.menu.signOut}
          </button>
        </form>
      </Menu.Root>
    {/if}
  </div>
{:else}
  <Button href="/signin" size="sm">{copy.menu.signIn}</Button>
{/if}
