<script lang="ts">
import * as Avatar from "$lib/components/ui/avatar/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
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
    <DropdownMenu.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
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
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-44">
        <DropdownMenu.Group>
          <DropdownMenu.Item onSelect={closeMenus}>
            {#snippet child({ props })}
              <a {...props} href="/">{copy.menu.home}</a>
            {/snippet}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={closeMenus}>
            {#snippet child({ props })}
              <a {...props} href={profileHref}>{copy.menu.me}</a>
            {/snippet}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={closeMenus}>
            {#snippet child({ props })}
              <a {...props} href="/settings/profile">{copy.menu.settings}</a>
            {/snippet}
          </DropdownMenu.Item>
          <form method="POST" action="/signout">
            <DropdownMenu.Item>
              {#snippet child({ props })}
                <button {...props} type="submit">
                  {copy.menu.signOut}
                </button>
              {/snippet}
            </DropdownMenu.Item>
          </form>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{:else}
  <Button href="/signin" size="sm">{copy.menu.signIn}</Button>
{/if}
