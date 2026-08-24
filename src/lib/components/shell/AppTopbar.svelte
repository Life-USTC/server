<script lang="ts">
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import { Button } from "$lib/components/ui/button/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import AppPreferencesMenu from "./AppPreferencesMenu.svelte";
import GlobalSearchTrigger from "./GlobalSearchTrigger.svelte";

export let closeMenus: () => void;
export let copy: LayoutCopy;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let onOpenGlobalSearch: () => void;
export let globalSearchShortcutLabel: string;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setThemeMenuOpen: (open: boolean) => void;
export let setThemeMode: (mode: ThemeMode) => void;
export let themeMenuOpen: boolean;
export let themeMode: ThemeMode;
export let user: LayoutUserSummary;
export let viewerLoading = false;
export let signedIn = false;
</script>

<header
  data-shell-topbar
  class="bg-card/95 sticky top-0 z-20 h-14 shrink-0 border-b backdrop-blur md:h-12"
>
  <div class="flex h-full items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-6">
    <Sidebar.Trigger
      aria-label={copy.shell.menu}
      class="size-11 md:hidden"
      onclick={closeMenus}
    />

    <a
      aria-label="Life@USTC"
      class="hidden size-11 shrink-0 items-center justify-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 min-[320px]:inline-flex md:hidden sm:w-auto sm:px-2"
      data-shell-brand
      href="/"
      title="Life@USTC"
    >
      <img
        class="size-7 rounded-md"
        src={appIconUrl}
        alt=""
        aria-hidden="true"
      />
      <span class="sr-only sm:not-sr-only">Life@USTC</span>
    </a>

    <div class="hidden min-w-0 flex-1 justify-center px-4 md:flex">
      <GlobalSearchTrigger
        copy={copy.globalSearch}
        onOpen={onOpenGlobalSearch}
        shortcutLabel={globalSearchShortcutLabel}
        {signedIn}
        variant="desktop"
      />
    </div>

    <div class="ml-auto flex items-center gap-1">
      <div class="md:hidden">
        <GlobalSearchTrigger
          copy={copy.globalSearch}
          onOpen={onOpenGlobalSearch}
          shortcutLabel={globalSearchShortcutLabel}
          {signedIn}
          variant="mobile"
        />
      </div>

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

      {#if viewerLoading}
        <Skeleton
          aria-hidden="true"
          class="h-8 w-20 rounded-md"
          data-testid="viewer-loading"
        />
      {:else if !user}
        <Button href="/account/sign-in">
          {copy.menu.signIn}
        </Button>
      {/if}
    </div>
  </div>
</header>
