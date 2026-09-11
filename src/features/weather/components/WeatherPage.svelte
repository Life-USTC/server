<script lang="ts">
import Droplets from "@lucide/svelte/icons/droplets";
import Thermometer from "@lucide/svelte/icons/thermometer";
import Wind from "@lucide/svelte/icons/wind";
import WeatherConditionIcon from "@/features/weather/components/WeatherConditionIcon.svelte";
import WeatherHourlyChart from "@/features/weather/components/WeatherHourlyChart.svelte";
import type { WeatherPageLocation } from "@/features/weather/server/weather-page-load";
import type { WeatherHourly } from "@/features/weather/server/weather-types";
import { temperatureRangePositions } from "@/features/weather/weather-ui";
import type { AppLocale } from "@/i18n/config";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import Panel from "$lib/components/Panel.svelte";
import {
  createShanghaiDateTimeFormatter,
  formatShanghaiTime,
} from "$lib/time/shanghai-format";

type Props = {
  locations: WeatherPageLocation[];
  locale: AppLocale;
  weatherCopy: AppPageCopy["weather"];
};

let { locations, locale, weatherCopy }: Props = $props();

const DAILY_SLOTS = 7;

const weekdayFormatter = $derived(
  createShanghaiDateTimeFormatter(locale, { weekday: "short" }),
);

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

const CHART_HOURLY_SLOTS = 24;

function upcomingHoursAll(hourly: WeatherHourly[]): WeatherHourly[] {
  const now = Date.now();
  const upcoming = hourly.filter((hour) => Date.parse(hour.at) >= now);
  return (upcoming.length > 0 ? upcoming : hourly).slice(0, CHART_HOURLY_SLOTS);
}

function formatTemperature(value: number) {
  return `${Math.round(value)}°`;
}
</script>

<div class="grid min-w-0 gap-5 md:grid-cols-2">
  {#each locations as { locationKey, snapshot } (locationKey)}
    <Panel>
      {#snippet header()}
        <h2 class="text-lg font-semibold">
          {weatherCopy.locationNames[locationKey]}
        </h2>
      {/snippet}

      {#if !snapshot}
        <p class="text-muted-foreground text-sm" data-testid="weather-unavailable">
          {weatherCopy.unavailable}
        </p>
      {:else}
        {@const today = snapshot.daily[0]}
        <div class="grid min-w-0 gap-6" data-testid="weather-location">
          <section class="grid grid-cols-[auto_auto] grid-rows-[4rem_auto] items-center justify-start gap-x-5 gap-y-1" data-testid="weather-current">
            <WeatherConditionIcon condition={snapshot.current.condition} class="size-16 text-amber-500" />
            <span class="text-6xl leading-none font-extralight tracking-tight" data-testid="weather-temperature">
              {formatTemperature(snapshot.current.temperature)}
            </span>
            <span class="text-center text-sm" data-testid="weather-condition">{snapshot.current.condition.text}</span>
            {#if today}
              <p class="text-muted-foreground text-sm" data-testid="weather-temperature-range">
                {formatTemperature(today.temperatureHigh)} / {formatTemperature(today.temperatureLow)}
              </p>
            {/if}
          </section>

          <section class="grid grid-cols-3 gap-2">
            {#if snapshot.current.feelsLike !== undefined}
              <div class="rounded-lg border p-2.5">
                <p
                  class="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Thermometer class="size-3.5" />
                  {weatherCopy.feelsLikeLabel}
                </p>
                <p class="mt-1 font-medium">
                  {formatTemperature(snapshot.current.feelsLike)}
                </p>
              </div>
            {/if}
            {#if snapshot.current.humidity !== undefined}
              <div class="rounded-lg border p-2.5">
                <p
                  class="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Droplets class="size-3.5" />
                  {weatherCopy.humidityLabel}
                </p>
                <p class="mt-1 font-medium">{snapshot.current.humidity}%</p>
              </div>
            {/if}
            {#if snapshot.current.windDirection && snapshot.current.windSpeed !== undefined}
              <div class="rounded-lg border p-2.5">
                <p
                  class="text-muted-foreground flex items-center gap-1 text-xs"
                >
                  <Wind class="size-3.5" />
                  {weatherCopy.windLabel}
                </p>
                <p class="mt-1 font-medium">
                  {formatTemplate(weatherCopy.wind, {
                    direction: snapshot.current.windDirection,
                    value: String(snapshot.current.windSpeed),
                  })}
                </p>
              </div>
            {/if}
          </section>

          {#if snapshot.hourly.length > 0}
            <section class="grid gap-2">
              <h3 class="text-sm font-medium">{weatherCopy.hourlyForecast}</h3>
              <WeatherHourlyChart
                hours={upcomingHoursAll(snapshot.hourly)}
                {weatherCopy}
              />
            </section>
          {/if}

          {#if snapshot.daily.length > 0}
            {@const days = snapshot.daily.slice(0, DAILY_SLOTS)}
            {@const ranges = temperatureRangePositions(
              days.map((d) => ({
                low: d.temperatureLow,
                high: d.temperatureHigh,
              })),
            )}
            <section class="grid gap-2">
              <h3 class="text-sm font-medium">{weatherCopy.dailyForecast}</h3>
              <ul class="grid gap-1.5">
                {#each days as day, i (day.date)}
                  <li class="flex items-center gap-3 text-sm">
                    <span class="w-12 shrink-0">
                      {i === 0
                        ? weatherCopy.today
                        : weekdayFormatter.format(new Date(day.date))}
                    </span>
                    <WeatherConditionIcon
                      condition={day.condition}
                      class="text-muted-foreground size-4 shrink-0"
                    />
                    <span class="text-muted-foreground w-8 text-right">
                      {formatTemperature(day.temperatureLow)}
                    </span>
                    <span
                      class="bg-muted relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                    >
                      <span
                        class="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                        style:left="{ranges[i].left}%"
                        style:width="{ranges[i].width}%"
                      ></span>
                    </span>
                    <span class="w-8 text-right font-medium">
                      {formatTemperature(day.temperatureHigh)}
                    </span>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          <section class="grid gap-2">
            <h3 class="text-sm font-medium">{weatherCopy.alerts}</h3>
            {#if snapshot.alerts.length === 0}
              <p class="text-muted-foreground text-sm">{weatherCopy.noAlerts}</p>
            {:else}
              <ul class="grid gap-1">
                {#each snapshot.alerts as alert (alert.title)}
                  <li class="text-sm">
                    <span class="font-medium">{alert.title}</span>
                    {#if alert.level}
                      <span class="text-muted-foreground"> ({alert.level})</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        </div>
      {/if}
    </Panel>
  {/each}
</div>

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
