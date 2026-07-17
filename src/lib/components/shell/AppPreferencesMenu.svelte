<script lang="ts">
import LanguagesIcon from "@lucide/svelte/icons/languages";
import MonitorIcon from "@lucide/svelte/icons/monitor";
import MoonIcon from "@lucide/svelte/icons/moon";
import SunIcon from "@lucide/svelte/icons/sun";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import type { LayoutCopy } from "$lib/shell/layout-server-data";

export let copy: LayoutCopy;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
export let mobile = false;
export let setLocale: (locale: "en-us" | "zh-cn") => void;
export let setLocaleMenuOpen: (open: boolean) => void;
export let setThemeMenuOpen: (open: boolean) => void;
export let setThemeMode: (mode: ThemeMode) => void;
export let themeMenuOpen: boolean;
export let themeMode: ThemeMode;

function setThemeValue(value: string) {
  if (value === "system" || value === "light" || value === "dark") {
    setThemeMode(value);
  }
}
</script>

<div
  data-shell-preferences
  class={mobile ? "grid gap-2" : "flex items-center gap-1.5"}
>
  <DropdownMenu.Root open={localeMenuOpen} onOpenChange={setLocaleMenuOpen}>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          aria-label={copy.language.selector}
          class={mobile ? "h-11 w-full justify-start px-3" : undefined}
          size={mobile ? "default" : "icon-sm"}
          variant="outline"
        >
          <LanguagesIcon data-icon="inline-start" />
          {#if mobile}
            <span>{copy.language.switch}</span>
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align={mobile ? "start" : "end"}
      class="w-40"
      preventScroll={false}
    >
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
          class={mobile ? "h-11 w-full justify-start px-3" : undefined}
          size={mobile ? "default" : "icon-sm"}
          variant="outline"
        >
          {#if themeMode === "light"}
            <SunIcon data-icon="inline-start" />
          {:else if themeMode === "dark"}
            <MoonIcon data-icon="inline-start" />
          {:else}
            <MonitorIcon data-icon="inline-start" />
          {/if}
          {#if mobile}
            <span>{copy.theme.selector}</span>
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align={mobile ? "start" : "end"}
      class="w-44"
      preventScroll={false}
    >
      <DropdownMenu.Group>
        <DropdownMenu.RadioGroup
          onValueChange={setThemeValue}
          value={themeMode}
        >
          <DropdownMenu.RadioItem value="system">
            <MonitorIcon />
            {copy.theme.system}
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="light">
            <SunIcon />
            {copy.theme.light}
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="dark">
            <MoonIcon />
            {copy.theme.dark}
          </DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
