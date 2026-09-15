<script lang="ts">
import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
import BusRouteDescription from "@/features/bus/components/BusRouteDescription.svelte";
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import {
  busStopTimeLabel,
  nextBusDepartures,
} from "@/features/workspace/lib/bus";
import type { WorkspaceBusCopy } from "@/features/workspace/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let busApplicableRoutes: BusApplicableRoute[];
export let busCopy: WorkspaceBusCopy;
export let busPlannerReady: boolean;
export let reverseBusStops: () => void;

$: departures = nextBusDepartures(busApplicableRoutes);
$: nextDeparture = departures[0];
$: emptyMessage =
  busApplicableRoutes.length > 0
    ? busCopy.noMoreBusToday
    : busCopy.planner.empty;
</script>

<section class="grid min-w-0 gap-3" data-testid="bus-compact-summary">
  <div class="grid gap-1">
    <p class="text-muted-foreground text-sm">{busCopy.nextDeparture}</p>
    {#if nextDeparture}
      <div class="flex flex-wrap items-end justify-between gap-3">
        <p class="font-mono text-4xl tabular-nums tracking-tight sm:text-5xl">
          {busStopTimeLabel(nextDeparture.trip.startTime)}
        </p>
        <div class="grid text-right text-muted-foreground text-xs">
          <span>{busCopy.arriveAt}</span>
          <span class="font-mono text-sm tabular-nums">
            {busStopTimeLabel(nextDeparture.trip.endTime)}
          </span>
        </div>
      </div>
    {:else}
      <p class="font-medium text-lg">{emptyMessage}</p>
    {/if}
  </div>

  {#if nextDeparture}
    <div class="grid gap-3">
      <div class="grid gap-1">
        <p class="min-w-0 font-medium">
          <BusRouteDescription description={nextDeparture.route.route.descriptionPrimary} />
        </p>
        <p class="text-muted-foreground text-sm">
          {nextDeparture.route.startStop.campus.namePrimary}
          →
          {nextDeparture.route.endStop.campus.namePrimary}
        </p>
      </div>

      {#if departures.length > 1}
        <div class="grid gap-2">
          <p class="font-medium text-sm">{busCopy.upcomingTrips}</p>
          <Item.Group class="grid gap-2 sm:grid-cols-2">
            {#each departures.slice(1) as departure}
              <Item.Root size="sm" variant="outline">
                <Item.Content>
                  <Item.Title class="font-mono text-base tabular-nums">
                    {busStopTimeLabel(departure.trip.startTime)}
                    →
                    {busStopTimeLabel(departure.trip.endTime)}
                  </Item.Title>
                  <Item.Description class="min-w-0">
                    <BusRouteDescription description={departure.route.route.descriptionPrimary} />
                  </Item.Description>
                </Item.Content>
              </Item.Root>
            {/each}
          </Item.Group>
        </div>
      {/if}
    </div>
  {:else}
    <Empty.Root class="p-0">
      <Empty.Header>
        <Empty.Description>{emptyMessage}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}

  <div class="flex flex-wrap justify-end gap-2">
    <Button
      class="h-11 md:h-8"
      disabled={!busPlannerReady}
      type="button"
      variant="outline"
      onclick={reverseBusStops}
    >
      <ArrowLeftRightIcon data-icon="inline-start" />
      {busCopy.planner.reverse}
    </Button>
    <Button class="h-11 md:h-8" href="/catalog/bus/map" variant="ghost">
      {busCopy.transitMap}
    </Button>
  </div>
</section>
