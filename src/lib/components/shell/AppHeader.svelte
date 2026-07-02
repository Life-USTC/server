<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import AppMobileMenu from "./AppMobileMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";
import type { ShellCopy, ShellLink, ShellNavGroup, ShellUser } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: ShellCopy;
export let mobileMenuOpen: boolean;
export let primaryLinks: ShellLink[];
export let profileHref: string;
export let setMobileMenuOpen: (open: boolean) => void;
export let setUserMenuOpen: (open: boolean) => void;
export let user: ShellUser;
export let userMenuOpen: boolean;

$: headerNavGroups = [
  {
    label: copy.shell.primaryNavigation,
    links: primaryLinks,
  },
] satisfies ShellNavGroup[];

function isActiveLink() {
  return false;
}
</script>

<header class="relative z-30 border-base-300 border-b bg-base-100/95 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
    <div class="min-w-0 flex-1">
      <a
        id="app-logo"
        class="inline-flex items-center gap-2 rounded-md py-2 font-semibold text-lg leading-none transition-opacity hover:opacity-75"
        href="/"
      >
        <img
          class="h-7 w-7 rounded-md"
          src="/images/icon.png"
          alt=""
          aria-hidden="true"
        />
        <span>Life@USTC</span>
      </a>
    </div>
    <nav aria-label={copy.shell.primaryNavigation} class="hidden items-center gap-1 sm:flex">
      {#each primaryLinks as link}
        <Button href={link.href} variant="ghost" size="sm">{link.label}</Button>
      {/each}
    </nav>
    <AppMobileMenu
      {closeMenus}
      {copy}
      {isActiveLink}
      {mobileMenuOpen}
      navGroups={headerNavGroups}
      {setMobileMenuOpen}
    />
    <AppUserMenu
      {avatarFallback}
      {closeMenus}
      {copy}
      {profileHref}
      {setUserMenuOpen}
      {user}
      {userMenuOpen}
    />
  </div>
</header>
