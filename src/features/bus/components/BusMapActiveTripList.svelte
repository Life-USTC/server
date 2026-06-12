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
  <ul class="grid max-h-72 gap-2 overflow-y-auto">
    {#each mapData.activeTrips as trip}
      {@const route = routeById(trip.routeId)}
      <li>
        <button
          class={`flex w-full items-center gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-left transition hover:bg-base-200/50 focus:outline-none focus:ring-2 focus:ring-primary/30 ${hoveredRoute === trip.routeId ? "bg-base-200/70" : ""}`}
          type="button"
          onmouseenter={() => {
            hoveredRoute = trip.routeId;
          }}
          onmouseleave={() => {
            hoveredRoute = null;
          }}
          onfocus={() => {
            hoveredRoute = trip.routeId;
          }}
          onblur={() => {
            hoveredRoute = null;
          }}
        >
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style={`background:${routeColor(trip.routeId, allRouteIds)}`}></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-xs">
              {route?.descriptionPrimary ?? `${copy.legend.route} ${trip.routeId}`}
            </span>
            <span class="block font-mono text-[10px] text-base-content/60 tabular-nums">
              {trip.departureTime ?? "--:--"} -> {trip.arrivalTime ?? "--:--"}
            </span>
          </span>
          <Badge variant={trip.status === "en-route" ? "secondary" : "outline"}>
            {activeTripBadge(trip)}
          </Badge>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-base-content/60 text-sm">{copy.status.noActive}</p>
{/if}
