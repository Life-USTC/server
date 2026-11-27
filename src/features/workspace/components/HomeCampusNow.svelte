<script lang="ts">
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import CloudSunIcon from "@lucide/svelte/icons/cloud-sun";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import type { DemoView } from "@/features/demo/lib/demo-types";
import { HOME_COMPACT_ITEM_COUNT } from "@/features/workspace/lib/anonymous-home-layout";
import type { HomeCampusNow } from "@/features/workspace/server/anonymous-home-sections";
import type { AppLocale } from "@/i18n/config";
import { HOME_CAMPUS_NOW_PATH } from "@/lib/navigation/internal-routes";
import { browser } from "$app/env";
import HomeSection from "./HomeSection.svelte";

/**
 * The shuttle board and weather tiles on `/`.
 *
 * `/` is served from the shared public HTML cache, so a departure board
 * rendered on the server would be reused for as long as the page is stored and
 * would claim buses that have already left. The board is read here instead,
 * against the request clock, from an endpoint that is never stored.
 *
 * Both cards keep their loaded height while loading, so the notices and
 * activities below them do not move when the board arrives.
 */
let {
  busTitle,
  campusNow,
  locale,
  weatherTitle,
  weatherLocationNames,
  demo = null,
}: {
  busTitle: string;
  locale: AppLocale;
  campusNow: {
    busDepartingNow: string;
    busEmpty: string;
    busMinutes: string;
    busOriginNote: string;
    busUnavailable: string;
    busViewAll: string;
    title: string;
    retryWeather: string;
    retryBus: string;
    weatherHourly: string;
    weatherRange: string;
    weatherUnavailable: string;
    weatherViewAll: string;
  };
  weatherTitle: string;
  weatherLocationNames: Record<string, string>;
  demo?: DemoView | null;
} = $props();

const shellViewer = getShellViewer();
const readEpoch = $derived(homePublicReadEpoch($shellViewer, demo));
async function readCampusNow(
  section: "weather" | "bus",
  controller: AbortController,
) {
  const response = await fetch(`${HOME_CAMPUS_NOW_PATH}?section=${section}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`campus-now ${response.status}`);
  return (await response.json()) as HomeCampusNow;
}
function campusBoard<K extends "weather" | "bus">(section: K) {
  let attempt = $state(0);
  let result = $state<{ epoch: string; value: HomeCampusNow[K] | null }>();

  $effect(() => {
    void attempt;
    void locale;
    const epoch = readEpoch;
    result = undefined;
    if (!browser || !epoch) return;
    const controller = new AbortController();
    function publish(value: HomeCampusNow[K] | null) {
      if (!controller.signal.aborted && readEpoch === epoch)
        result = { epoch, value };
    }
    void readCampusNow(section, controller).then(
      (body) => publish(body[section]),
      () => publish(null),
    );
    return () => controller.abort();
  });

  return {
    get value() {
      return result && result.epoch === readEpoch ? result.value : undefined;
    },
    retry() {
      attempt += 1;
    },
  };
}

const weatherBoard = campusBoard("weather");
const busBoard = campusBoard("bus");
const weather = $derived(weatherBoard.value);
const bus = $derived(busBoard.value);
</script>

{#snippet note(message: string)}
  <p class="text-muted-foreground text-sm">{message}</p>
{/snippet}

<!--
  The placeholders mirror the loaded structure rather than being generic bars,
  so each card already occupies the height its real content will take and the
  notices and activities below it do not get shoved down when the board lands.
  Matches the shell's `viewer-loading` skeleton treatment.
-->
{#snippet weatherPlaceholder()}
  <div aria-hidden="true" class="grid grid-cols-2 gap-x-4 gap-y-2" data-testid="home-campus-now-loading">
    {#each [0, 1] as tile (tile)}
      <div aria-hidden="true" class="grid min-w-0 gap-1">
        <Skeleton class="h-5 w-16 rounded" />
        <Skeleton class="h-8 w-20 rounded" />
        <Skeleton class="hidden h-5 w-24 rounded lg:block" />
        <Skeleton class="hidden h-8 w-full rounded lg:block" />
      </div>
    {/each}
  </div>
{/snippet}

{#snippet busPlaceholder()}
  <div aria-hidden="true" class="grid gap-1.5" data-testid="home-campus-now-loading">
    <Skeleton aria-hidden="true" class="h-5 w-28 rounded" />
    {#each Array.from({ length: HOME_COMPACT_ITEM_COUNT }, (_, index) => index) as row (row)}
      <Skeleton aria-hidden="true" class="h-6 w-full rounded" />
    {/each}
  </div>
{/snippet}

<!--
  `aria-busy` on the stable section, matching the shell's `viewer-loading`
  skeletons: the pending state is exposed on a container that never changes
  identity, instead of a live region that would re-announce the board on every
  refresh. The skeletons themselves carry no text and stay out of the tree.
-->
<section
  aria-busy={weather === undefined || bus === undefined}
  class="grid min-w-0 gap-3 lg:col-span-2"
  data-testid="home-campus-now"
>
  <h2 class="sr-only">{campusNow.title}</h2>
  <!--
    `items-start` so an unavailable or short card keeps its own height. Equal
    rows turned the weather card into a tall empty box whenever the shuttle
    board beside it had more rows than the weather had readings.
  -->
  <div class="grid min-w-0 items-start gap-3 sm:grid-cols-2">
    <HomeSection nested testId="home-weather" busy={weather === undefined}
      title={weatherTitle} icon={CloudSunIcon} href="/catalog/weather" linkLabel={campusNow.weatherViewAll}
    >
      {#if weather === null || weather?.length === 0}
        {@render note(campusNow.weatherUnavailable)}
        <Button class="justify-self-start" variant="outline" size="sm" onclick={weatherBoard.retry}>{campusNow.retryWeather}</Button>
      {:else if weather === undefined}
        {@render weatherPlaceholder()}
      {:else}
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
          {#each weather ?? [] as tile (tile.locationKey)}
            <div class="min-w-0">
              <dt class="truncate text-muted-foreground text-sm">
                {weatherLocationNames[tile.locationKey] ?? tile.locationKey}
              </dt>
              <dd class="grid min-w-0 gap-1">
                <span class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  {#if tile.temperature}
                    <span class="font-semibold text-2xl tabular-nums tracking-tight">
                      {tile.temperature}
                    </span>
                  {/if}
                  <span class="min-w-0 truncate text-muted-foreground text-sm">
                    {tile.condition}
                  </span>
                </span>
                {#if tile.rangeLabel}
                  <span class="hidden text-muted-foreground text-sm tabular-nums lg:block">
                    {tile.rangeLabel}
                  </span>
                {/if}
                {#if tile.hourly.length > 0}
                  <span class="hidden min-w-0 flex-wrap gap-x-3 gap-y-1 lg:flex">
                    <span class="sr-only">{campusNow.weatherHourly}</span>
                    {#each tile.hourly as hour (hour.key)}
                      <span class="grid shrink-0 justify-items-start">
                        <span class="text-muted-foreground text-xs tabular-nums">
                          {hour.label}
                        </span>
                        <span class="text-sm tabular-nums">{hour.temperature}</span>
                      </span>
                    {/each}
                  </span>
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      {/if}
    </HomeSection>

    <HomeSection nested testId="home-bus" busy={bus === undefined}
      title={busTitle} icon={BusFrontIcon} href="/catalog/bus" linkLabel={campusNow.busViewAll}
    >
      {#if bus === null}
        {@render note(campusNow.busUnavailable)}
        <Button class="justify-self-start" variant="outline" size="sm" onclick={busBoard.retry}>{campusNow.retryBus}</Button>
      {:else if bus === undefined}
        {@render busPlaceholder()}
      {:else if bus && bus.departures.length === 0}
        {@render note(bus.emptyNote)}
      {:else if bus}
        {@render note(bus.originNote)}
        <ul class="grid gap-1.5">
          {#each bus.departures as departure, index (departure.key)}
            <li
              class={["min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5", index < HOME_COMPACT_ITEM_COUNT ? "flex" : "hidden lg:flex"]}
            >
              <span class="min-w-0 truncate">{departure.destination}</span>
              <span class="flex shrink-0 items-baseline gap-2">
                <span class="tabular-nums">{departure.departureTime}</span>
                <span class="text-muted-foreground text-sm">
                  {departure.relativeLabel}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </HomeSection>
  </div>
</section>
