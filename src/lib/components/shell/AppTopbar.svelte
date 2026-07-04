<script lang="ts">
import LanguagesIcon from "@lucide/svelte/icons/languages";
import MonitorIcon from "@lucide/svelte/icons/monitor";
import MoonIcon from "@lucide/svelte/icons/moon";
import SunIcon from "@lucide/svelte/icons/sun";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import AppMobileMenu from "./AppMobileMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";
import type { ShellLink, ShellNavGroup } from "./types";

export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: LayoutCopy;
export let isActiveLink: (link: ShellLink) => boolean;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let mobileMenuOpen: boolean;
export let navGroups: ShellNavGroup[];
export let profileHref: string;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setMobileMenuOpen: (open: boolean) => void;
export let setThemeMenuOpen: (open: boolean) => void;
export let setThemeMode: (mode: ThemeMode) => void;
export let setUserMenuOpen: (open: boolean) => void;
export let themeMenuOpen: boolean;
export let themeMode: ThemeMode;
export let user: LayoutUserSummary;
export let userMenuOpen: boolean;
</script>

<header class="sticky top-0 h-12 shrink-0 border-base-300 border-b bg-base-100/95 backdrop-blur">
  <div class="flex h-full items-center gap-2 px-3 sm:px-5 lg:px-6">
    <AppMobileMenu
      {closeMenus}
      {copy}
      {isActiveLink}
      {mobileMenuOpen}
      {navGroups}
      {setMobileMenuOpen}
    />
    <Sidebar.Trigger class="hidden lg:inline-flex" />

    <a
      class="inline-flex min-w-0 items-center gap-2 rounded-md font-semibold leading-none transition-opacity hover:opacity-75 lg:hidden"
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
      <DropdownMenu.Root open={localeMenuOpen} onOpenChange={setLocaleMenuOpen}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              aria-label={copy.language.selector}
              size="icon-sm"
              variant="outline"
            >
              <LanguagesIcon data-icon="inline-start" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-40" preventScroll={false}>
          <DropdownMenu.Group>
            <DropdownMenu.RadioGroup value={locale}>
              <DropdownMenu.RadioItem
                onSelect={() => setLocale("en-us")}
                value="en-us"
              >
                {copy.language.english}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem
                onSelect={() => setLocale("zh-cn")}
                value="zh-cn"
              >
                {copy.language.chinese}
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <DropdownMenu.Root open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              aria-label={copy.theme.selector}
              size="icon-sm"
              variant="outline"
            >
              {#if themeMode === "light"}
                <SunIcon data-icon="inline-start" />
              {:else if themeMode === "dark"}
                <MoonIcon data-icon="inline-start" />
              {:else}
                <MonitorIcon data-icon="inline-start" />
              {/if}
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-44" preventScroll={false}>
          <DropdownMenu.Group>
            <DropdownMenu.RadioGroup value={themeMode}>
              <DropdownMenu.RadioItem
                onSelect={() => setThemeMode("system")}
                value="system"
              >
                <MonitorIcon />
                {copy.theme.system}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem
                onSelect={() => setThemeMode("light")}
                value="light"
              >
                <SunIcon />
                {copy.theme.light}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem
                onSelect={() => setThemeMode("dark")}
                value="dark"
              >
                <MoonIcon />
                {copy.theme.dark}
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

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
