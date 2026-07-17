<script lang="ts">
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import AppPreferencesMenu from "./AppPreferencesMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: LayoutCopy;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let profileHref: string;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setThemeMenuOpen: (open: boolean) => void;
export let setThemeMode: (mode: ThemeMode) => void;
export let setUserMenuOpen: (open: boolean) => void;
export let themeMenuOpen: boolean;
export let themeMode: ThemeMode;
export let user: LayoutUserSummary;
export let userMenuOpen: boolean;
</script>

<header
  data-shell-topbar
  class="bg-card/95 sticky top-0 z-20 h-14 shrink-0 border-b backdrop-blur md:h-12"
>
  <div class="flex h-full items-center gap-2 px-3 sm:px-5 lg:px-6">
    <Sidebar.Trigger
      aria-label={copy.shell.menu}
      class="size-11 md:size-7"
      onclick={closeMenus}
    />

    <a
      class="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 lg:hidden"
      href="/"
    >
      <img
        class="size-7 rounded-md"
        src="/images/icon.png"
        alt=""
        aria-hidden="true"
      />
      <span class="truncate">Life@USTC</span>
    </a>

    <div class="ml-auto flex items-center gap-1.5">
      <div class="hidden md:block">
        <AppPreferencesMenu
          {copy}
          {locale}
          {localeMenuOpen}
          {setLocale}
          {setLocaleMenuOpen}
          {setThemeMenuOpen}
          {setThemeMode}
          {themeMenuOpen}
          {themeMode}
        />
      </div>

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
  </div>
</header>
