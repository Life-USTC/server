<script lang="ts">
import appIconUrl from "#lib/assets/life-ustc-icon-192.png";
import type { ThemeMode } from "#lib/components/shell/layout-shell.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Sidebar from "#lib/components/ui/sidebar/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "#lib/shell/layout-server-data.js";
import type { DemoView } from "@/features/demo/lib/demo-types";
import AppPreferencesMenu from "./AppPreferencesMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";
import GlobalSearchTrigger from "./GlobalSearchTrigger.svelte";

interface Props {
  avatarFallback?: string;
  currentPathname?: string;
  profileHref?: string;
  setUserMenuOpen?: (open: boolean) => void;
  userMenuOpen?: boolean;
  demo?: DemoView | null;
  closeMenus: () => void;
  copy: LayoutCopy;
  focused?: boolean;
  locale: "en-us" | "zh-cn";
  localeMenuOpen: boolean;
  onOpenGlobalSearch: () => void;
  globalSearchShortcutLabel: string;
  setLocale: (locale: "en-us" | "zh-cn") => void;
  setLocaleMenuOpen: (open: boolean) => void;
  setThemeMenuOpen: (open: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  themeMenuOpen: boolean;
  themeMode: ThemeMode;
  user: LayoutUserSummary;
  viewerLoading?: boolean;
  signedIn?: boolean;
  /** Hide the Sign in control when the visitor is already on the sign-in route. */
  hideSignIn?: boolean;
  homeHref?: string;
  homeLabel?: string;
}

let {
  avatarFallback = "",
  currentPathname = "/",
  profileHref = "/",
  setUserMenuOpen = () => {},
  userMenuOpen = false,
  demo = null,
  closeMenus,
  copy,
  focused = false,
  locale,
  localeMenuOpen,
  onOpenGlobalSearch,
  globalSearchShortcutLabel,
  setLocale,
  setLocaleMenuOpen,
  setThemeMenuOpen,
  setThemeMode,
  themeMenuOpen,
  themeMode,
  user,
  viewerLoading = false,
  signedIn = false,
  hideSignIn = false,
  homeHref = "/",
  homeLabel = copy.shell.discovery.home,
}: Props = $props();
</script>

<header
  data-shell-topbar
  class="bg-card/95 sticky top-0 z-20 min-h-14 shrink-0 border-b backdrop-blur md:h-12 md:min-h-12"
>
  <div
    class="flex min-h-14 items-center gap-1 px-2 md:h-full md:min-h-0 sm:gap-2 sm:px-3 lg:px-6"
  >
    {#if !focused}
      <!-- #1077: stay visible/focusable through the tablet range (hidden only
           at >=1024px), while the focused onboarding shell has no sidebar to
           toggle at all. -->
      <Sidebar.Trigger
        aria-label={copy.shell.menu}
        class="size-11 lg:hidden"
        onclick={closeMenus}
      />
    {/if}

    <a
      aria-label={`Life@USTC: ${homeLabel}`}
      class="hidden h-11 min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 min-[320px]:inline-flex px-1 sm:px-2 {focused
        ? ''
        : 'lg:hidden'}"
      data-shell-brand
      href={homeHref}
      title={homeLabel}
    >
      <img
        class="size-7 rounded-md"
        src={appIconUrl}
        alt=""
        aria-hidden="true"
      />
      <span class="sr-only sm:not-sr-only">Life@USTC</span>
      <span class="text-xs font-normal">{homeLabel}</span>
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

    <div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
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
        <Skeleton
          aria-hidden="true"
          class="h-8 w-20 rounded-md"
          data-testid="viewer-loading"
        />
      {:else if user || demo}
        <AppUserMenu
          {avatarFallback}
          {closeMenus}
          {copy}
          {currentPathname}
          {profileHref}
          {setUserMenuOpen}
          {user}
          {userMenuOpen}
          {demo}
        />
      {:else if !hideSignIn}
        <Button href="/account/sign-in" data-shell-sign-in>
          {copy.menu.signIn}
        </Button>
      {/if}
    </div>
  </div>
</header>
