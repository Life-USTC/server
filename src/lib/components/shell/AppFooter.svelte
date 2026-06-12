<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Menu from "$lib/components/ui/menu/index.js";
import type { ShellCopy, ShellLink } from "./types";

export let copy: ShellCopy;
export let cycleTheme: () => void;
export let footerLinks: ShellLink[];
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let themeButtonLabel: string;
export let toggleLocaleMenu: () => void;
</script>

<footer class="border-base-300 border-t bg-base-100">
  <div
    class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-base-content/60 text-sm sm:flex-row sm:items-center sm:justify-between"
  >
    <nav class="flex flex-wrap items-center gap-x-5 gap-y-2">
      {#each footerLinks as link}
        <a
          class="transition-colors hover:text-base-content"
          href={link.href}
          rel={link.rel}
          target={link.target}
        >
          {link.label}
        </a>
      {/each}
    </nav>
    <div class="flex items-center gap-2">
      <div class="relative">
        <Button
          aria-label={copy.language.selector}
          aria-expanded={localeMenuOpen}
          aria-haspopup="menu"
          onclick={toggleLocaleMenu}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <span aria-hidden="true" class="font-semibold text-xs">文</span>
        </Button>
        {#if localeMenuOpen}
          <Menu.Root align="right" class="bottom-full mb-2 mt-0 w-40">
            <Menu.Item
              checked={locale === "en-us"}
              onclick={() => setLocale("en-us")}
              radio
            >
              {copy.language.english}
            </Menu.Item>
            <Menu.Item
              checked={locale === "zh-cn"}
              onclick={() => setLocale("zh-cn")}
              radio
            >
              {copy.language.chinese}
            </Menu.Item>
          </Menu.Root>
        {/if}
      </div>
      <Button
        aria-label={themeButtonLabel}
        onclick={cycleTheme}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <span aria-hidden="true" class="h-3.5 w-3.5 rounded-full border border-current bg-current/20"></span>
      </Button>
    </div>
  </div>
</footer>
