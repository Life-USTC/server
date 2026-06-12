<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import AppMobileMenu from "./AppMobileMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";
import type { ShellCopy, ShellLink, ShellUser } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: ShellCopy;
export let mobileMenuOpen: boolean;
export let primaryLinks: ShellLink[];
export let profileHref: string;
export let toggleMobileMenu: () => void;
export let toggleUserMenu: () => void;
export let user: ShellUser;
export let userMenuOpen: boolean;
</script>

<header class="border-base-300 border-b bg-base-100/95 backdrop-blur">
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
      {mobileMenuOpen}
      {primaryLinks}
      {toggleMobileMenu}
    />
    <AppUserMenu
      {avatarFallback}
      {closeMenus}
      {copy}
      {profileHref}
      {toggleUserMenu}
      {user}
      {userMenuOpen}
    />
  </div>
</header>
