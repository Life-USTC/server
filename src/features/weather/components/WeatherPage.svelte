<script lang="ts">
import Panel from "#lib/components/Panel.svelte";
import * as Tabs from "#lib/components/ui/tabs/index.js";
import { IsMobile } from "#lib/hooks/is-mobile.svelte.js";
import { formatShanghaiTime } from "#lib/time/shanghai-format.js";
import WeatherLocationPanel from "@/features/weather/components/WeatherLocationPanel.svelte";
import type { WeatherPageLocation } from "@/features/weather/server/weather-page-load";
import type { AppLocale } from "@/i18n/config";
import type { AppPageCopy } from "@/lib/shell/page-copy";

type Props = {
  locations: WeatherPageLocation[];
  locale: AppLocale;
  weatherCopy: AppPageCopy["weather"];
};

let { locations, locale, weatherCopy }: Props = $props();

const isMobile = new IsMobile();

let activeCampus = $state("ustc-main");

function onCampusChange(value: string) {
  if (value) activeCampus = value;
}

const latestFetchedAt = $derived(
  locations.reduce<string | undefined>(
    (latest, { snapshot }) =>
      snapshot &&
      (!latest || Date.parse(snapshot.fetchedAt) > Date.parse(latest))
        ? snapshot.fetchedAt
        : latest,
    undefined,
  ),
);

const allProviders = $derived([
  ...new Set(locations.flatMap(({ snapshot }) => snapshot?.providers ?? [])),
]);

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}
</script>

<!-- Mobile: segmented campus tabs (本部 | 高新). Desktop keeps both panels. -->
{#if isMobile.current}
<div data-testid="weather-campus-tabs">
  <Tabs.Root value={activeCampus} onValueChange={onCampusChange}>
    <Tabs.List
      class="grid h-auto w-full grid-cols-2"
      aria-label={weatherCopy.campusTabsLabel}
    >
      {#each locations as { locationKey } (locationKey)}
        <Tabs.Trigger
          value={locationKey}
          data-weather-tab={locationKey}
          class="text-sm"
        >
          {weatherCopy.locationTabNames[locationKey]}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
    {#each locations as location (location.locationKey)}
      <Tabs.Content value={location.locationKey} class="mt-4">
        <Panel>
          {#snippet header()}
            <h2 class="text-lg font-semibold" data-weather-location={location.locationKey}>
              {weatherCopy.locationNames[location.locationKey]}
            </h2>
          {/snippet}
          <WeatherLocationPanel
            {location}
            {locale}
            showHeading={false}
            {weatherCopy}
          />
        </Panel>
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</div>

{:else}
<div class="grid min-w-0 gap-5 grid-cols-2" data-testid="weather-campus-grid">
  {#each locations as location (location.locationKey)}
    <Panel>
      {#snippet header()}
        <h2
          class="text-lg font-semibold"
          data-weather-location={location.locationKey}
        >
          {weatherCopy.locationNames[location.locationKey]}
        </h2>
      {/snippet}
      <WeatherLocationPanel
        {location}
        {locale}
        showHeading={false}
        {weatherCopy}
      />
    </Panel>
  {/each}
</div>

{/if}

{#if latestFetchedAt}
  <div
    class="text-muted-foreground mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs"
    data-testid="weather-page-meta"
  >
    <span>
      {formatTemplate(weatherCopy.updatedAt, {
        value: formatShanghaiTime(latestFetchedAt),
      })}
    </span>
    {#if allProviders.length > 0}
      <span>{weatherCopy.dataProviders}: {allProviders.join(", ")}</span>
    {/if}
  </div>
{/if}
