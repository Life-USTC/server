<script lang="ts">
import Droplets from "@lucide/svelte/icons/droplets";
import Thermometer from "@lucide/svelte/icons/thermometer";
import Wind from "@lucide/svelte/icons/wind";
import { createShanghaiDateTimeFormatter } from "#lib/time/shanghai-format.js";
import WeatherConditionIcon from "@/features/weather/components/WeatherConditionIcon.svelte";
import WeatherHourlyChart from "@/features/weather/components/WeatherHourlyChart.svelte";
import type { WeatherPageLocation } from "@/features/weather/server/weather-page-load";
import { temperatureRangePositions } from "@/features/weather/weather-ui";
import type { AppLocale } from "@/i18n/config";
import type { AppPageCopy } from "@/lib/shell/page-copy";

type Props = {
  location: WeatherPageLocation;
  locale: AppLocale;
  showHeading?: boolean;
  weatherCopy: AppPageCopy["weather"];
};

let { location, locale, showHeading = true, weatherCopy }: Props = $props();

const DAILY_SLOTS = 7;
const { locationKey, snapshot } = $derived(location);

const weekdayFormatter = $derived(
  createShanghaiDateTimeFormatter(locale, { weekday: "short" }),
);

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template,
  );
}

function formatTemperature(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}°`;
}
</script>

{#if showHeading}
  <h2 class="text-lg font-semibold" data-weather-location={locationKey}>
    {weatherCopy.locationNames[locationKey]}
  </h2>
{/if}

{#if !snapshot}
  <p class="text-muted-foreground text-sm" data-testid="weather-unavailable">
    {weatherCopy.unavailable}
  </p>
{:else}
  {@const today = snapshot.daily[0]}
  <div
    class="grid min-w-0 gap-6"
    data-testid="weather-location"
    data-weather-location={locationKey}
  >
    <section
      class="grid grid-cols-[auto_auto] grid-rows-[4rem_auto] items-center justify-start gap-x-5 gap-y-1"
      data-testid="weather-current"
    >
      <WeatherConditionIcon
        condition={snapshot.current.condition}
        class="size-16 text-amber-500"
      />
      <span
        class="text-6xl leading-none font-extralight tracking-tight"
        data-testid="weather-temperature"
      >
        {formatTemperature(snapshot.current.temperature)}
      </span>
      <span class="text-center text-sm" data-testid="weather-condition"
        >{snapshot.current.condition.text}</span
      >
      {#if today}
        <p
          class="text-muted-foreground text-sm"
          data-testid="weather-temperature-range"
        >
          {formatTemperature(today.temperatureHigh)} / {formatTemperature(
            today.temperatureLow,
          )}
        </p>
      {/if}
    </section>

    <section class="grid grid-cols-3 gap-2">
      {#if snapshot.current.feelsLike !== undefined}
        <div class="rounded-lg border p-2.5">
          <p class="text-muted-foreground flex items-center gap-1 text-xs">
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
          <p class="text-muted-foreground flex items-center gap-1 text-xs">
            <Droplets class="size-3.5" />
            {weatherCopy.humidityLabel}
          </p>
          <p class="mt-1 font-medium">{snapshot.current.humidity}%</p>
        </div>
      {/if}
      {#if snapshot.current.windDirection && snapshot.current.windSpeed !== undefined}
        <div class="rounded-lg border p-2.5">
          <p class="text-muted-foreground flex items-center gap-1 text-xs">
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
        <WeatherHourlyChart hours={snapshot.hourly} {weatherCopy} />
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
                  class="absolute inset-y-0 rounded-full bg-gradient-to-r from-[var(--weather-temp-low)] to-[var(--weather-temp-high)]"
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
