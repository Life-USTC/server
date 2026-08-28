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
import GlobalSearchTrigger from "./GlobalSearchTrigger.svelte";

export let closeMenus: () => void;
export let copy: LayoutCopy;
export let focused = false;
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
    {#if !focused}
      <Sidebar.Trigger
        aria-label={copy.shell.menu}
        class="size-11 md:hidden"
        onclick={closeMenus}
      />
    {/if}

    <a
      class="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 {focused
        ? ''
        : 'md:hidden'}"
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

    {#if !focused}
      <div class="hidden min-w-0 flex-1 justify-center px-4 md:flex">
        <GlobalSearchTrigger
          copy={copy.globalSearch}
          onOpen={onOpenGlobalSearch}
          shortcutLabel={globalSearchShortcutLabel}
          {signedIn}
          variant="desktop"
        />
      </div>
    {/if}

    <div class="ml-auto flex items-center gap-1">
      {#if !focused}
        <div class="md:hidden">
          <GlobalSearchTrigger
            copy={copy.globalSearch}
            onOpen={onOpenGlobalSearch}
            shortcutLabel={globalSearchShortcutLabel}
            {signedIn}
            variant="mobile"
          />
        </div>
      {/if}

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
        <div
          aria-hidden="true"
          class="h-8 w-20 animate-pulse rounded-md bg-muted"
          data-testid="viewer-loading"
        ></div>
      {:else if !user}
        <Button href="/account/sign-in">
          {copy.menu.signIn}
        </Button>
      {/if}
    </div>
  </div>
</header>
