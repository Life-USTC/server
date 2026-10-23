<script lang="ts">
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import CloudSunIcon from "@lucide/svelte/icons/cloud-sun";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { HOME_COMPACT_ITEM_COUNT } from "@/features/workspace/lib/anonymous-home-layout";
import type { HomeCampusNow } from "@/features/workspace/server/anonymous-home-sections";
import { HOME_CAMPUS_NOW_PATH } from "@/lib/navigation/internal-routes";
import { browser } from "$app/env";

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
  weatherTitle,
  weatherLocationNames,
}: {
  busTitle: string;
  campusNow: {
    busDepartingNow: string;
    busEmpty: string;
    busMinutes: string;
    busOriginNote: string;
    busUnavailable: string;
    busViewAll: string;
    title: string;
    weatherHourly: string;
    weatherRange: string;
    weatherUnavailable: string;
    weatherViewAll: string;
  };
  weatherTitle: string;
  weatherLocationNames: Record<string, string>;
} = $props();

let data = $state<HomeCampusNow | null>(null);
let failed = $state(false);

$effect(() => {
  if (!browser) return;
  const controller = new AbortController();
  void (async () => {
    try {
      const response = await fetch(HOME_CAMPUS_NOW_PATH, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`campus-now ${response.status}`);
      const body = (await response.json()) as HomeCampusNow;
      if (!controller.signal.aborted) data = body;
    } catch {
      if (!controller.signal.aborted) failed = true;
    }
  })();
  return () => controller.abort();
});

const weather = $derived(data?.weather ?? null);
const bus = $derived(data?.bus ?? null);

/**
 * Rows past the compact count are shipped to every viewport and revealed by the
 * breakpoint, so a phone keeps the list it had while a wide canvas fills the
 * column it already owns.
 */
function overflowClass(index: number, shown: string, hidden: string): string {
  return index < HOME_COMPACT_ITEM_COUNT ? shown : hidden;
}
</script>

{#snippet heading(
  title: string,
  icon: typeof CloudSunIcon,
  viewAllHref: string,
  viewAllLabel: string,
)}
  {@const Icon = icon}
  <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <h3 class="flex min-w-0 items-center gap-2 font-semibold text-base tracking-tight">
      <Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="min-w-0 truncate">{title}</span>
    </h3>
    <Button
      class="h-auto min-h-6 gap-0.5 px-0 text-muted-foreground md:min-h-6"
      href={viewAllHref}
      size="sm"
      variant="link"
    >
      {viewAllLabel}
      <ChevronRightIcon class="size-4" aria-hidden="true" />
    </Button>
  </div>
{/snippet}

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
  aria-busy={!data && !failed}
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
    <div class="grid min-w-0 content-start gap-2 rounded-lg border p-4">
      {@render heading(weatherTitle, CloudSunIcon, "/catalog/weather", campusNow.weatherViewAll)}
      {#if failed || (data && (weather === null || weather.length === 0))}
        {@render note(campusNow.weatherUnavailable)}
      {:else if !data}
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
    </div>

    <div class="grid min-w-0 content-start gap-2 rounded-lg border p-4">
      {@render heading(busTitle, BusFrontIcon, "/catalog/bus", campusNow.busViewAll)}
      {#if failed || (data && bus === null)}
        {@render note(campusNow.busUnavailable)}
      {:else if !data}
        {@render busPlaceholder()}
      {:else if bus && bus.departures.length === 0}
        {@render note(bus.emptyNote)}
      {:else if bus}
        {@render note(bus.originNote)}
        <ul class="grid gap-1.5">
          {#each bus.departures as departure, index (departure.key)}
            <li
              class={overflowClass(
                index,
                "flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5",
                "hidden min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 lg:flex",
              )}
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
    </div>
  </div>
</section>
