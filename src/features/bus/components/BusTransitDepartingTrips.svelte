<script lang="ts">
import BusMapVehicleGlyph from "@/features/bus/components/BusMapVehicleGlyph.svelte";
import {
  BUS_W,
  NODE_R,
  routeColor,
} from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapActiveTrip,
  BusMapData,
  BusMapPoint,
} from "@/features/bus/lib/bus-map-types";

export let allRouteIds: number[];
export let departingSoonTrips: BusMapActiveTrip[];
export let departingTripsByCampus: Map<number, BusMapActiveTrip[]>;
export let hoveredRoute: number | null;
export let mapData: BusMapData;
export let positions: Map<number, BusMapPoint>;
</script>

{#each departingSoonTrips as trip}
  {@const route = mapData.routes.find((item) => item.routeId === trip.routeId)}
  {#if route}
    {@const firstStop = route.stops[0]}
    {@const position = firstStop ? positions.get(firstStop.campusId) : null}
    {#if position}
      {@const siblings = firstStop ? departingTripsByCampus.get(firstStop.campusId) ?? [] : []}
      {@const siblingIndex = siblings.indexOf(trip)}
      {@const siblingCount = Math.max(1, siblings.length)}
      {@const spread = siblingCount > 1 ? (Math.PI * 0.6) / (siblingCount - 1) : 0}
      {@const angle = -Math.PI / 2 - (spread * (siblingCount - 1)) / 2 + siblingIndex * spread}
      {@const markerRadius = NODE_R + 14}
      {@const x = position.x + Math.cos(angle) * markerRadius}
      {@const y = position.y + Math.sin(angle) * markerRadius}
      {@const nextStop = route.stops[1]}
      {@const nextPosition = nextStop ? positions.get(nextStop.campusId) : null}
      {@const busAngle = nextPosition ? Math.atan2(nextPosition.y - position.y, nextPosition.x - position.x) * (180 / Math.PI) : 0}
      <g
        role="presentation"
        onmouseenter={() => {
          hoveredRoute = trip.routeId;
        }}
      >
        <circle cx={x} cy={y} fill="none" stroke={routeColor(trip.routeId, allRouteIds)} stroke-width="1.5">
          <animate attributeName="r" values={`${BUS_W / 2 + 2};${BUS_W / 2 + 12};${BUS_W / 2 + 2}`} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.05;0.6" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <BusMapVehicleGlyph
          angle={busAngle}
          color={routeColor(trip.routeId, allRouteIds)}
          opacity={0.85}
          x={x}
          y={y}
        />
      </g>
    {/if}
  {/if}
{/each}
