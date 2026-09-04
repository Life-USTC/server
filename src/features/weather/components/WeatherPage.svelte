<script lang="ts">
import Cloud from "@lucide/svelte/icons/cloud";
import CloudDrizzle from "@lucide/svelte/icons/cloud-drizzle";
import CloudFog from "@lucide/svelte/icons/cloud-fog";
import CloudHail from "@lucide/svelte/icons/cloud-hail";
import CloudLightning from "@lucide/svelte/icons/cloud-lightning";
import CloudRain from "@lucide/svelte/icons/cloud-rain";
import CloudSnow from "@lucide/svelte/icons/cloud-snow";
import CloudSun from "@lucide/svelte/icons/cloud-sun";
import Cloudy from "@lucide/svelte/icons/cloudy";
import Droplets from "@lucide/svelte/icons/droplets";
import Sun from "@lucide/svelte/icons/sun";
import Thermometer from "@lucide/svelte/icons/thermometer";
import Wind from "@lucide/svelte/icons/wind";
import WeatherHourlyChart from "@/features/weather/components/WeatherHourlyChart.svelte";
import type { WeatherPageLocation } from "@/features/weather/server/weather-page-load";
import type {
  WeatherCondition,
  WeatherHourly,
} from "@/features/weather/server/weather-types";
import {
  temperatureRangePositions,
  type WeatherIconName,
  weatherConditionIcon,
} from "@/features/weather/weather-ui";
import type { DashboardPageCopy } from "@/features/workspace/server/dashboard-page-load-types";
import type { AppLocale } from "@/i18n/config";
import Panel from "$lib/components/Panel.svelte";
import {
  createShanghaiDateTimeFormatter,
  formatShanghaiTime,
} from "$lib/time/shanghai-format";

type Props = {
  locations: WeatherPageLocation[];
  locale: AppLocale;
  weatherCopy: DashboardPageCopy["weather"];
};

let { locations, locale, weatherCopy }: Props = $props();

const HOURLY_SLOTS = 12;
const DAILY_SLOTS = 7;

const ICON_COMPONENTS = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  cloudy: Cloudy,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-hail": CloudHail,
  "cloud-lightning": CloudLightning,
} as const;

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

function iconOf(condition: WeatherCondition | undefined) {
  return ICON_COMPONENTS[
    weatherConditionIcon(condition ?? { text: "", icon: "unknown" })
  ];
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

function upcomingHours(hourly: WeatherHourly[]): WeatherHourly[] {
  const now = Date.now();
  const upcoming = hourly.filter((hour) => Date.parse(hour.at) >= now);
  return (upcoming.length > 0 ? upcoming : hourly).slice(0, HOURLY_SLOTS);
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
        {@const HeroIcon = iconOf(snapshot.current.condition)}
        <div class="grid min-w-0 gap-6" data-testid="weather-location">
          <section class="flex items-center gap-5">
            <HeroIcon class="size-16 shrink-0 text-amber-500" strokeWidth={1.5} />
            <div class="min-w-0">
              <div class="flex items-baseline gap-3">
                <span
                  class="text-6xl leading-none font-extralight tracking-tight"
                  data-testid="weather-temperature"
                >
                  {formatTemperature(snapshot.current.temperature)}
                </span>
                <span class="text-lg">{snapshot.current.condition.text}</span>
              </div>
              {#if today}
                <p class="text-muted-foreground mt-1 text-sm">
                  {formatTemperature(today.temperatureHigh)} / {formatTemperature(
                    today.temperatureLow,
                  )}
                </p>
              {/if}
            </div>
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
                chartAriaLabel={weatherCopy.hourlyForecast}
              />
              <!-- svelte-ignore a11y_no_noninteractive_tabindex (focus enables keyboard scrolling for the overflowing hourly strip) -->
              <div
                aria-label={weatherCopy.hourlyForecast}
                class="-mx-1 overflow-x-auto px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="weather-hourly-scroll-region"
                role="region"
                tabindex="0"
              >
                <ul class="flex gap-1">
                  {#each upcomingHours(snapshot.hourly) as hour (hour.at)}
                    {@const HourIcon = iconOf(hour.condition)}
                    <li
                      class="flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg border py-2 text-sm"
                    >
                      <span class="text-muted-foreground text-xs">
                        {formatShanghaiTime(hour.at)}
                      </span>
                      <HourIcon class="size-5" strokeWidth={1.5} />
                      {#if hour.precipitationProbability !== undefined && hour.precipitationProbability > 0}
                        <span class="text-xs font-medium text-sky-600 dark:text-sky-400">
                          {hour.precipitationProbability}%
                        </span>
                      {:else}
                        <span class="text-xs text-transparent">0%</span>
                      {/if}
                      <span class="font-medium">
                        {formatTemperature(hour.temperature)}
                      </span>
                    </li>
                  {/each}
                </ul>
              </div>
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
                  {@const DayIcon = iconOf(day.condition)}
                  <li class="flex items-center gap-3 text-sm">
                    <span class="w-12 shrink-0">
                      {i === 0
                        ? weatherCopy.today
                        : weekdayFormatter.format(new Date(day.date))}
                    </span>
                    <DayIcon
                      class="text-muted-foreground size-4 shrink-0"
                      strokeWidth={1.5}
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
