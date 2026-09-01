<script lang="ts">
import type { DashboardPageCopy } from "@/features/dashboard/server/dashboard-page-load-types";
import type { WeatherPageLocation } from "@/features/weather/server/weather-page-load";
import type { WeatherHourly } from "@/features/weather/server/weather-types";
import Panel from "$lib/components/Panel.svelte";
import {
  formatShanghaiDate,
  formatShanghaiTime,
} from "$lib/time/shanghai-format";

type Props = {
  locations: WeatherPageLocation[];
  weatherCopy: DashboardPageCopy["weather"];
};

let { locations, weatherCopy }: Props = $props();

const HOURLY_SLOTS = 8;
const DAILY_SLOTS = 5;

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

function formatTemperature(value: number) {
  return `${Math.round(value)}°`;
}
</script>

<div class="grid min-w-0 gap-5 md:grid-cols-2">
  {#each locations as { locationKey, snapshot } (locationKey)}
    <Panel>
      {#snippet header()}
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-lg font-semibold">
            {weatherCopy.locationNames[locationKey]}
          </h2>
          {#if snapshot}
            <span class="text-muted-foreground text-sm">
              {formatTemplate(weatherCopy.updatedAt, {
                value: formatShanghaiTime(snapshot.fetchedAt),
              })}
            </span>
          {/if}
        </div>
      {/snippet}

      {#if !snapshot}
        <p class="text-muted-foreground text-sm" data-testid="weather-unavailable">
          {weatherCopy.unavailable}
        </p>
      {:else}
        <div class="grid min-w-0 gap-5" data-testid="weather-location">
          <section class="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div class="flex items-baseline gap-3">
              <span class="text-4xl font-bold" data-testid="weather-temperature">
                {formatTemperature(snapshot.current.temperature)}
              </span>
              <span class="text-lg">{snapshot.current.condition.text}</span>
            </div>
            <div
              class="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm"
            >
              {#if snapshot.current.feelsLike !== undefined}
                <span>
                  {formatTemplate(weatherCopy.feelsLike, {
                    value: String(Math.round(snapshot.current.feelsLike)),
                  })}
                </span>
              {/if}
              {#if snapshot.current.humidity !== undefined}
                <span>
                  {formatTemplate(weatherCopy.humidity, {
                    value: String(snapshot.current.humidity),
                  })}
                </span>
              {/if}
              {#if snapshot.current.windDirection && snapshot.current.windSpeed !== undefined}
                <span>
                  {formatTemplate(weatherCopy.wind, {
                    direction: snapshot.current.windDirection,
                    value: String(snapshot.current.windSpeed),
                  })}
                </span>
              {/if}
            </div>
          </section>

          {#if snapshot.hourly.length > 0}
            <section class="grid gap-2">
              <h3 class="text-sm font-medium">{weatherCopy.hourlyForecast}</h3>
              <ul class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {#each upcomingHours(snapshot.hourly) as hour (hour.at)}
                  <li class="rounded-md border p-2 text-sm">
                    <p class="text-muted-foreground">
                      {formatShanghaiTime(hour.at)}
                    </p>
                    <p class="font-medium">
                      {formatTemperature(hour.temperature)}
                      {#if hour.condition}
                        <span class="font-normal text-muted-foreground">
                          {hour.condition.text}
                        </span>
                      {/if}
                    </p>
                    {#if hour.precipitationProbability !== undefined}
                      <p class="text-muted-foreground text-xs">
                        {formatTemplate(weatherCopy.precipitationProbability, {
                          value: String(hour.precipitationProbability),
                        })}
                      </p>
                    {/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          {#if snapshot.daily.length > 0}
            <section class="grid gap-2">
              <h3 class="text-sm font-medium">{weatherCopy.dailyForecast}</h3>
              <ul class="grid gap-1">
                {#each snapshot.daily.slice(0, DAILY_SLOTS) as day (day.date)}
                  <li class="flex items-center justify-between gap-3 text-sm">
                    <span>{formatShanghaiDate(day.date)}</span>
                    <span class="text-muted-foreground">
                      {day.condition?.text ?? ""}
                    </span>
                    <span class="font-medium">
                      {formatTemperature(day.temperatureLow)} / {formatTemperature(
                        day.temperatureHigh,
                      )}
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

      {#snippet footer()}
        {#if snapshot}
          <span class="text-muted-foreground text-xs">
            {weatherCopy.dataProviders}: {snapshot.providers.join(", ")}
          </span>
        {/if}
      {/snippet}
    </Panel>
  {/each}
</div>
