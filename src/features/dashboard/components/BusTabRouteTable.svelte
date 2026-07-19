<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { onMount } from "svelte";
import BusRouteDescription from "@/features/bus/components/BusRouteDescription.svelte";
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import {
  busRouteSegmentStopColumns,
  busStopTimeLabel,
  busTripStopTimeForOrder,
} from "@/features/dashboard/lib/bus";
import * as Card from "$lib/components/ui/card/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { cn } from "$lib/utils.js";

export let busNextTripHighlightKey: string | null;
export let route: BusApplicableRoute;

let canScrollLeft = false;
let canScrollRight = false;
let tableRegion: HTMLDivElement;

$: stopColumns = busRouteSegmentStopColumns(route);
$: tableMinWidth = `${Math.max(16, stopColumns.length * 4.25)}rem`;

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
  <Card.Root class="min-w-0">
    <Card.Header>
      <Card.Title>
        <BusRouteDescription description={route.route.descriptionPrimary} />
      </Card.Title>
    </Card.Header>
    <Card.Content class="min-w-0">
      <div
        bind:this={tableRegion}
        class="relative min-w-0"
        data-testid="bus-timetable-scroll-region"
        style="--table-min-width: {tableMinWidth}"
      >
        <Table.Root class="min-w-[var(--table-min-width)]">
          <Table.Header>
            <Table.Row>
              {#each stopColumns as stop, index}
                <Table.Head
                  class={index === 0
                    ? "text-left"
                    : index === stopColumns.length - 1
                      ? "text-right"
                      : "text-center"}
                >
                  {stop.label}
                </Table.Head>
              {/each}
            </Table.Row>
          </Table.Header>
          <Table.Body>
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
                    class={cn(
                      index === 0
                        ? "text-left"
                        : index === stopColumns.length - 1
                          ? "text-right"
                          : "text-center",
                    )}
                  >
                    <span class="font-mono tabular-nums">
                      {busStopTimeLabel(stopTime)}
                    </span>
                  </Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
        {#if canScrollLeft}
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center bg-gradient-to-r from-card to-transparent pl-1"
            data-testid="bus-timetable-scroll-cue-left"
          >
            <ChevronLeftIcon class="size-4 rounded-full bg-card/90 text-muted-foreground shadow-sm" />
          </div>
        {/if}
        {#if canScrollRight}
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-card to-transparent pr-1"
            data-testid="bus-timetable-scroll-cue-right"
          >
            <ChevronRightIcon class="size-4 rounded-full bg-card/90 text-muted-foreground shadow-sm" />
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</section>
