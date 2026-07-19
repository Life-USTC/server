<script lang="ts">
import { onMount } from "svelte";
import type { AppLocale } from "@/i18n/config";
import {
  loadStoredThemeMode,
  setStoredThemeMode,
} from "$lib/components/shell/app-shell-actions";
import type { ThemeMode } from "$lib/components/shell/layout-shell";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import { setClientLocale } from "$lib/locale/client-locale";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
export let locale: AppLocale;

let themeMode: ThemeMode = "system";

function selectTheme(value: string) {
  if (value === "system" || value === "light" || value === "dark") {
    themeMode = setStoredThemeMode(value);
  }
}

function selectLocale(value: string) {
  if (value !== "zh-cn" && value !== "en-us") return;

  void setClientLocale({
    currentLocale: locale,
    locale: value,
    onBeforeRequest: () => {},
  });
}

onMount(() => {
  themeMode = loadStoredThemeMode(themeMode);
});
</script>

<Card.Root
  aria-labelledby="settings-preferences-title"
  role="region"
>
  <Card.Header>
    <Card.Title id="settings-preferences-title">
      {copy.settings.preferences.title}
    </Card.Title>
    <Card.Description>
      {copy.settings.preferences.description}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <Field.Group>
      <Field.Field orientation="responsive">
        <Field.Content>
          <Field.Title id="settings-appearance-label">
            {copy.settings.preferences.appearance.title}
          </Field.Title>
          <Field.Description>
            {copy.settings.preferences.appearance.description}
          </Field.Description>
        </Field.Content>
        <ToggleGroup.Root
          aria-labelledby="settings-appearance-label"
          class="grid w-full grid-cols-3"
          spacing={2}
          type="single"
          value={themeMode}
          variant="outline"
          onValueChange={selectTheme}
        >
          <ToggleGroup.Item class="w-full" value="system">
            {copy.theme.system}
          </ToggleGroup.Item>
          <ToggleGroup.Item class="w-full" value="light">
            {copy.theme.light}
          </ToggleGroup.Item>
          <ToggleGroup.Item class="w-full" value="dark">
            {copy.theme.dark}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </Field.Field>

      <Field.Field orientation="responsive">
        <Field.Content>
          <Field.Title id="settings-language-label">
            {copy.settings.preferences.language.title}
          </Field.Title>
          <Field.Description>
            {copy.settings.preferences.language.description}
          </Field.Description>
        </Field.Content>
        <ToggleGroup.Root
          aria-labelledby="settings-language-label"
          class="grid w-full grid-cols-2"
          spacing={2}
          type="single"
          value={locale}
          variant="outline"
          onValueChange={selectLocale}
        >
          <ToggleGroup.Item class="w-full" value="zh-cn">
            {copy.language.chinese}
          </ToggleGroup.Item>
          <ToggleGroup.Item class="w-full" value="en-us">
            {copy.language.english}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </Field.Field>
    </Field.Group>
  </Card.Content>
</Card.Root>
