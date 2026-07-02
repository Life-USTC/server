<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
import type { ShellCopy, ShellUser } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: ShellCopy;
export let profileHref: string;
export let setUserMenuOpen: (open: boolean) => void;
export let user: ShellUser;
export let userMenuOpen: boolean;
</script>

{#if user}
  <div id="app-user-menu" class="relative">
    <Menu.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
      <Menu.Trigger
        aria-label={copy.shell.profileMenu}
        class="overflow-hidden"
        size="icon"
        variant="outline"
      >
        <Avatar.Root class="size-7 border-0">
          {#if user.image}
            <Avatar.Image
              src={user.image}
              alt={user.name ?? copy.shell.profileMenu}
            />
          {/if}
          <Avatar.Fallback>{avatarFallback}</Avatar.Fallback>
        </Avatar.Root>
      </Menu.Trigger>
      <Menu.Content align="end" class="w-44">
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
          <Menu.Item type="submit">
            {copy.menu.signOut}
          </Menu.Item>
        </form>
      </Menu.Content>
    </Menu.Root>
  </div>
{:else}
  <Button href="/signin" size="sm">{copy.menu.signIn}</Button>
{/if}
