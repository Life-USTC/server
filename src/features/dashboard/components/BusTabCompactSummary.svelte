<script lang="ts">
import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import {
  busStopTimeLabel,
  nextBusDepartures,
} from "@/features/dashboard/lib/bus";
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let busApplicableRoutes: BusApplicableRoute[];
export let busCopy: DashboardBusCopy;
export let busPlannerReady: boolean;
export let reverseBusStops: () => void;

$: departures = nextBusDepartures(busApplicableRoutes);
$: nextDeparture = departures[0];
$: emptyMessage =
  busApplicableRoutes.length > 0
    ? busCopy.noMoreBusToday
    : busCopy.planner.empty;
</script>

<Card.Root data-testid="bus-compact-summary">
  <Card.Header>
    <Card.Description>{busCopy.nextDeparture}</Card.Description>
    {#if nextDeparture}
      <Card.Title class="font-mono text-4xl tabular-nums sm:text-5xl">
        {busStopTimeLabel(nextDeparture.trip.startTime)}
      </Card.Title>
      <Card.Action>
        <span class="grid text-right text-muted-foreground text-xs">
          <span>{busCopy.arriveAt}</span>
          <span class="font-mono text-sm tabular-nums">
            {busStopTimeLabel(nextDeparture.trip.endTime)}
          </span>
        </span>
      </Card.Action>
    {:else}
      <Card.Title>{emptyMessage}</Card.Title>
    {/if}
  </Card.Header>

  <Card.Content>
    {#if nextDeparture}
      <div class="grid gap-4">
        <div class="grid gap-1">
          <p class="font-medium">{nextDeparture.route.route.descriptionPrimary}</p>
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
                <Item.Root size="sm" variant="muted">
                  <Item.Content>
                    <Item.Title class="font-mono text-base tabular-nums">
                      {busStopTimeLabel(departure.trip.startTime)}
                      →
                      {busStopTimeLabel(departure.trip.endTime)}
                    </Item.Title>
                    <Item.Description>
                      {departure.route.route.descriptionPrimary}
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
  </Card.Content>

  <Card.Footer class="flex-wrap justify-end gap-2">
    <Button
      disabled={!busPlannerReady}
      type="button"
      variant="outline"
      onclick={reverseBusStops}
    >
      <ArrowLeftRightIcon data-icon="inline-start" />
      {busCopy.planner.reverse}
    </Button>
    <Button href="/bus-map" variant="ghost">{busCopy.transitMap}</Button>
  </Card.Footer>
</Card.Root>
