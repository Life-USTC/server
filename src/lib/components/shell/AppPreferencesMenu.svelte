<script lang="ts">
import LanguagesIcon from "@lucide/svelte/icons/languages";
import MonitorCogIcon from "@lucide/svelte/icons/monitor-cog";
import MoonIcon from "@lucide/svelte/icons/moon";
import SunIcon from "@lucide/svelte/icons/sun";
import type { ThemeMode } from "#lib/components/shell/layout-shell.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";

export let copy: LayoutCopy;
export let locale: "en-us" | "zh-cn";
export let localeMenuOpen: boolean;
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

<div data-shell-preferences class="flex items-center gap-0.5 min-[360px]:gap-2">
  <DropdownMenu.Root open={localeMenuOpen} onOpenChange={setLocaleMenuOpen}>
    <DropdownMenu.Trigger>
      {#snippet render({ props })}
        <Button
          {...props}
          aria-label={copy.language.selector}
          class="icon-action"
          size="icon-sm"
          variant="outline"
        >
          <LanguagesIcon class="size-3.5" aria-hidden="true" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      class="w-40"
    >
      <DropdownMenu.Group>
        <DropdownMenu.RadioGroup value={locale} onValueChange={(next) => setLocale(next === "zh-cn" ? "zh-cn" : "en-us")}>
          <DropdownMenu.RadioItem
            value="en-us"
          >
            {copy.language.english}
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem
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
      {#snippet render({ props })}
        <Button
          {...props}
          aria-label={copy.theme.selector}
          class="icon-action"
          size="icon-sm"
          variant="outline"
        >
          {#if themeMode === "light"}
            <SunIcon class="size-3.5" aria-hidden="true" />
          {:else if themeMode === "dark"}
            <MoonIcon class="size-3.5" aria-hidden="true" />
          {:else}
            <MonitorCogIcon class="size-3.5" aria-hidden="true" />
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      class="w-44"
    >
      <DropdownMenu.Group>
        <DropdownMenu.RadioGroup
          onValueChange={setThemeValue}
          value={themeMode}
        >
          <DropdownMenu.RadioItem value="system">
            <MonitorCogIcon />
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
