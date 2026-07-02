<script lang="ts">
import LanguagesIcon from "@lucide/svelte/icons/languages";
import SunMoonIcon from "@lucide/svelte/icons/sun-moon";
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
import type {
  LayoutCopy,
  LayoutUserSummary,
} from "$lib/shell/layout-server-data";
import AppMobileMenu from "./AppMobileMenu.svelte";
import AppUserMenu from "./AppUserMenu.svelte";
import type { ShellLink, ShellNavGroup } from "./types";

export let activeTitle: string;
export let avatarFallback: string;
export let closeMenus: () => void;
export let copy: LayoutCopy;
export let cycleTheme: () => void;
export let isActiveLink: (link: ShellLink) => boolean;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let mobileMenuOpen: boolean;
export let navGroups: ShellNavGroup[];
export let profileHref: string;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setMobileMenuOpen: (open: boolean) => void;
export let setUserMenuOpen: (open: boolean) => void;
export let themeButtonLabel: string;
export let user: LayoutUserSummary;
export let userMenuOpen: boolean;
</script>

<header class="sticky top-0 border-base-300 border-b bg-base-100/95 backdrop-blur">
  <div class="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
    <AppMobileMenu
      {closeMenus}
      {copy}
      {isActiveLink}
      {mobileMenuOpen}
      {navGroups}
      {setMobileMenuOpen}
    />

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

    <div class="hidden min-w-0 flex-1 lg:block">
      <p class="truncate font-medium text-sm">{activeTitle}</p>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Menu.Root open={localeMenuOpen} onOpenChange={setLocaleMenuOpen}>
        <Menu.Trigger
          aria-label={copy.language.selector}
          size="icon-sm"
          variant="outline"
        >
          <LanguagesIcon data-icon="inline-start" />
        </Menu.Trigger>
        <Menu.Content align="end" class="w-40">
          <Menu.RadioGroup value={locale}>
            <Menu.RadioItem
              onclick={() => setLocale("en-us")}
              value="en-us"
            >
              {copy.language.english}
            </Menu.RadioItem>
            <Menu.RadioItem
              onclick={() => setLocale("zh-cn")}
              value="zh-cn"
            >
              {copy.language.chinese}
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Root>

      <Button
        aria-label={themeButtonLabel}
        onclick={cycleTheme}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <SunMoonIcon data-icon="inline-start" />
      </Button>

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
