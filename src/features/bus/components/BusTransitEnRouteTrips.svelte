<script lang="ts">
import BusMapVehicleGlyph from "@/features/bus/components/BusMapVehicleGlyph.svelte";
import {
  computeBusTransform,
  routeColor,
} from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapActiveTrip,
  BusMapData,
  BusMapPoint,
} from "@/features/bus/lib/bus-map-types";

export let allRouteIds: number[];
export let enRouteTrips: BusMapActiveTrip[];
export let hoveredRoute: number | null;
export let mapData: BusMapData;
export let offsets: Map<string, Map<number, number>>;
export let positions: Map<number, BusMapPoint>;
</script>

{#each enRouteTrips as trip}
  {@const route = mapData.routes.find((item) => item.routeId === trip.routeId)}
  {@const transform = route ? computeBusTransform(trip, route, positions, offsets) : null}
  {#if route && transform}
    <BusMapVehicleGlyph
      animate
      angle={transform.angle}
      color={routeColor(trip.routeId, allRouteIds)}
      onHover={() => {
        hoveredRoute = trip.routeId;
      }}
      x={transform.x}
      y={transform.y}
    />
  {/if}
{/each}
