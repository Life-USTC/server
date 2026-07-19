<script lang="ts">
import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
import LogOutIcon from "@lucide/svelte/icons/log-out";
import SettingsIcon from "@lucide/svelte/icons/settings";
import UserRoundIcon from "@lucide/svelte/icons/user-round";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type { ShellCopy, ShellUser } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: ShellCopy;
export let currentPathname: string;
export let profileHref: string;
export let setUserMenuOpen: (open: boolean) => void;
export let user: ShellUser;
export let userMenuOpen: boolean;

// biome-ignore lint/correctness/useHookAtTopLevel: useSidebar is a Svelte context helper, not a React hook
const sidebar = Sidebar.useSidebar();

function closeAccountNavigation() {
  closeMenus();
  sidebar.setOpenMobile(false);
}

function isSettingsPath(pathname: string) {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}
</script>

{#if user}
  <Sidebar.Menu id="app-user-menu">
    <Sidebar.MenuItem>
      <DropdownMenu.Root open={userMenuOpen} onOpenChange={setUserMenuOpen}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Sidebar.MenuButton
              {...props}
              aria-label={copy.shell.profileMenu}
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              isActive={currentPathname === profileHref ||
                isSettingsPath(currentPathname)}
              size="lg"
              tooltipContent={user.name ?? copy.shell.profileMenu}
            >
              <Avatar.Root class="size-8 rounded-lg">
                {#if user.image}
                  <Avatar.Image
                    src={user.image}
                    alt={user.name ?? copy.shell.profileMenu}
                  />
                {/if}
                <Avatar.Fallback class="rounded-lg">
                  {avatarFallback}
                </Avatar.Fallback>
              </Avatar.Root>
              <span class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">
                  {user.name ?? copy.menu.me}
                </span>
                <span class="truncate text-xs">
                  {user.username ? `@${user.username}` : copy.menu.me}
                </span>
              </span>
              <ChevronsUpDownIcon class="ms-auto" />
            </Sidebar.MenuButton>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          class="w-56"
          preventScroll={false}
          side="top"
        >
          <DropdownMenu.Group>
            <DropdownMenu.Item onSelect={closeAccountNavigation}>
              {#snippet child({ props })}
                <a
                  {...props}
                  aria-current={currentPathname === profileHref
                    ? "page"
                    : undefined}
                  href={profileHref}
                >
                  <UserRoundIcon />
                  {copy.menu.me}
                </a>
              {/snippet}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={closeAccountNavigation}>
              {#snippet child({ props })}
                <a
                  {...props}
                  aria-current={isSettingsPath(currentPathname)
                    ? "page"
                    : undefined}
                  href="/settings/preferences"
                >
                  <SettingsIcon />
                  {copy.menu.settings}
                </a>
              {/snippet}
            </DropdownMenu.Item>
            <form method="POST" action="/signout">
              <DropdownMenu.Item>
                {#snippet child({ props })}
                  <button {...props} type="submit">
                    <LogOutIcon />
                    {copy.menu.signOut}
                  </button>
                {/snippet}
              </DropdownMenu.Item>
            </form>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Sidebar.MenuItem>
  </Sidebar.Menu>
{/if}
