<script lang="ts">
import {
  hhmmToMin,
  routeColor,
} from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapActiveTrip,
  BusMapCopy,
  BusMapData,
} from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

export let allRouteIds: number[];
export let copy: BusMapCopy;
export let hoveredRoute: number | null;
export let mapData: BusMapData;
export let nowMinutes: number;

function formatMessage(template: string, values: Record<string, string>) {
  return template.replace(
    /\{(\w+)}/g,
    (_match, key: string) => values[key] ?? "",
  );
}

function routeById(routeId: number) {
  return mapData.routes.find((route) => route.routeId === routeId) ?? null;
}

function activeTripBadge(trip: BusMapActiveTrip) {
  if (trip.status === "en-route") return copy.status.enRoute;
  const departureMinutes = hhmmToMin(trip.departureTime);
  return formatMessage(copy.status.departingSoon, {
    minutes: String(
      departureMinutes == null ? 0 : Math.max(0, departureMinutes - nowMinutes),
    ),
  });
}
</script>

{#if mapData.activeTrips.length > 0}
  <ScrollArea class="h-72">
    <Item.Group role="list">
      {#each mapData.activeTrips as trip}
        {@const route = routeById(trip.routeId)}
        <Item.Root
          size="xs"
          variant={hoveredRoute === trip.routeId ? "muted" : "outline"}
          onpointerenter={() => {
            hoveredRoute = trip.routeId;
          }}
          onpointerleave={() => {
            hoveredRoute = null;
          }}
        >
          <span class="size-2.5 shrink-0 rounded-full" style={`background:${routeColor(trip.routeId, allRouteIds)}`}></span>
          <Item.Content>
            <Item.Title>{route?.descriptionPrimary ?? `${copy.legend.route} ${trip.routeId}`}</Item.Title>
            <Item.Description class="font-mono tabular-nums">
              {trip.departureTime ?? "--:--"} -> {trip.arrivalTime ?? "--:--"}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Badge variant={trip.status === "en-route" ? "secondary" : "outline"}>
              {activeTripBadge(trip)}
            </Badge>
          </Item.Actions>
        </Item.Root>
      {/each}
    </Item.Group>
  </ScrollArea>
{:else}
  <Empty.Root class="min-h-20 border border-border bg-background p-4">
    <Empty.Header>
      <Empty.Description>{copy.status.noActive}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
