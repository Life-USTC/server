<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { onMount, type Snippet } from "svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import { cn } from "#lib/utils.js";
import BusRouteDescription from "@/features/bus/components/BusRouteDescription.svelte";
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import { busStopFilterFields } from "@/features/bus/lib/bus-table-filters";
import {
  busRouteSegmentStopColumns,
  busStopTimeLabel,
  busTripStopTimeForOrder,
} from "@/features/workspace/lib/bus";
import type { WorkspaceBusCopy } from "@/features/workspace/lib/bus-tab-types";

export let busNextTripHighlightKey: string | null;
export let routes: BusApplicableRoute[];
export let label: string;
export let filterValues: Record<string, string>;
export let onFilterChange: (patch: Record<string, string>) => void;
export let formId: string;
export let busCopy: WorkspaceBusCopy;
export let empty: Snippet;

let canScrollLeft = false;
let canScrollRight = false;
let tableRegion: HTMLDivElement;

$: routeGroups = routes.map((route) => ({
  route,
  stopColumns: busRouteSegmentStopColumns(route),
}));
$: columnCount = Math.max(
  1,
  ...routeGroups.map(({ stopColumns }) => stopColumns.length),
);
$: tableMinWidth = `${Math.max(16, columnCount * 4.25)}rem`;

onMount(() => {
  const scroller = tableRegion.querySelector<HTMLElement>(
    '[data-slot="table-container"]',
  );
  const table = scroller?.querySelector("table");
  if (!scroller || !table) return;

  const updateScrollCues = () => {
    canScrollLeft = scroller.scrollLeft > 1;
    canScrollRight =
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
  };
  const resizeObserver = new ResizeObserver(updateScrollCues);

  scroller.addEventListener("scroll", updateScrollCues, { passive: true });
  resizeObserver.observe(scroller);
  resizeObserver.observe(table);
  updateScrollCues();

  return () => {
    scroller.removeEventListener("scroll", updateScrollCues);
    resizeObserver.disconnect();
  };
});
</script>

<section class="min-w-0">
  <div
    bind:this={tableRegion}
    class="relative min-w-0"
    data-testid="bus-timetable-scroll-region"
    style="--table-min-width: {tableMinWidth}"
  >
    <Table.Root class="min-w-[var(--table-min-width)]">
      <Table.Caption class="sr-only">{label}</Table.Caption>
      {#each routeGroups as { route, stopColumns } (route.route.id)}
        <Table.Body data-testid="bus-route-section">
          <Table.Row>
            <Table.Head colspan={columnCount} scope="rowgroup">
              <h3 class="min-w-0 font-medium text-sm">
                <BusRouteDescription description={route.route.descriptionPrimary} />
              </h3>
            </Table.Head>
          </Table.Row>
          <Table.Row>
            {#each stopColumns as stop, index}
              <Table.Head
                id={`bus-route-${route.route.id}-stop-${stop.stopOrder}`}
                scope="col"
                colspan={index === stopColumns.length - 1 ? columnCount - stopColumns.length + 1 : 1}
                class="text-left"
              >
                <TableFieldFilter label={stop.label} fields={busStopFilterFields(route.route.stops.find((item) => item.stopOrder === stop.stopOrder)!.campus.id, stop.label, busCopy)} values={filterValues} onchange={onFilterChange} labels={busCopy.tableFilters} idPrefix={`bus-route-${route.route.id}-stop-${stop.stopOrder}`} {formId} />
              </Table.Head>
            {/each}
          </Table.Row>
          {#each route.visibleTrips as trip}
            {@const tripKey = `${route.route.id}:${trip.trip.id}`}
            {@const isNextTrip = tripKey === busNextTripHighlightKey}
            <Table.Row
              class={cn(
                trip.status === "departed" ? "opacity-60" : undefined,
                isNextTrip ? "bg-muted/70 hover:bg-muted" : undefined,
              )}
            >
              {#each stopColumns as stop, index}
                {@const stopTime = busTripStopTimeForOrder(trip, stop.stopOrder)}
                <Table.Cell
                  headers={`bus-route-${route.route.id}-stop-${stop.stopOrder}`}
                  colspan={index === stopColumns.length - 1 ? columnCount - stopColumns.length + 1 : 1}
                  class="text-left"
                >
                  <span class="font-mono tabular-nums">{busStopTimeLabel(stopTime)}</span>
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      {:else}
        <Table.Body><Table.Row><Table.Cell colspan={columnCount}>{@render empty()}</Table.Cell></Table.Row></Table.Body>
      {/each}
    </Table.Root>
    {#if canScrollLeft}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center bg-gradient-to-r from-background to-transparent pl-1"
        data-testid="bus-timetable-scroll-cue-left"
      >
        <ChevronLeftIcon class="size-4 rounded-full bg-background/90 text-muted-foreground shadow-sm" />
      </div>
    {/if}
    {#if canScrollRight}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-background to-transparent pr-1"
        data-testid="bus-timetable-scroll-cue-right"
      >
        <ChevronRightIcon class="size-4 rounded-full bg-background/90 text-muted-foreground shadow-sm" />
      </div>
    {/if}
  </div>
</section>
