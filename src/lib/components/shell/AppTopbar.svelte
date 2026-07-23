<script lang="ts">
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import { Button } from "$lib/components/ui/button/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import AppPreferencesMenu from "./AppPreferencesMenu.svelte";

export let closeMenus: () => void;
export let copy: LayoutCopy;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setThemeMenuOpen: (open: boolean) => void;
export let setThemeMode: (mode: ThemeMode) => void;
export let themeMenuOpen: boolean;
export let themeMode: ThemeMode;
export let user: LayoutUserSummary;
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
      class="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 md:hidden"
      href="/"
    >
      <img
        class="size-7 rounded-md"
        src={appIconUrl}
        alt=""
        aria-hidden="true"
      />
      <span class="truncate">Life@USTC</span>
    </a>

    <div class="ml-auto flex items-center gap-1">
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

      {#if !user}
        <Button href="/signin" size="sm">
          {copy.menu.signIn}
        </Button>
      {/if}
    </div>
  </div>
</header>
