<script lang="ts">
import { onMount } from "svelte";
import { SVG_H, SVG_W } from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapActiveTrip,
  BusMapCopy,
  BusMapData,
  BusMapPoint,
  BusMapRoutePath,
} from "@/features/bus/lib/bus-map-types";
import BusTransitCampusNodes from "./BusTransitCampusNodes.svelte";
import BusTransitDepartingTrips from "./BusTransitDepartingTrips.svelte";
import BusTransitEnRouteTrips from "./BusTransitEnRouteTrips.svelte";
import BusTransitRouteLayers from "./BusTransitRouteLayers.svelte";

export let activeRouteIds: Set<number>;
export let allRouteIds: number[];
export let copy: BusMapCopy;
export let departingSoonTrips: BusMapActiveTrip[];
export let departingTripsByCampus: Map<number, BusMapActiveTrip[]>;
export let enRouteTrips: BusMapActiveTrip[];
export let hoveredRoute: number | null;
export let mapData: BusMapData;
export let offsets: Map<string, Map<number, number>>;
export let positions: Map<number, BusMapPoint>;
export let routePaths: Map<number, BusMapRoutePath>;

let svgElement: SVGSVGElement;

onMount(() => {
  const viewport = svgElement.closest<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  );
  if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;
  viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
});
</script>

<svg
  bind:this={svgElement}
  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
  class="h-auto w-full min-w-[45rem] rounded-md border border-border bg-card md:min-h-[34rem] md:min-w-0"
  role="img"
  aria-label={copy.mapTitle}
  onmouseleave={() => {
    hoveredRoute = null;
  }}
>
  <title>{copy.mapTitle}</title>
  <BusTransitRouteLayers
    {activeRouteIds}
    {allRouteIds}
    bind:hoveredRoute
    routes={mapData.routes}
    {routePaths}
  />

  <BusTransitEnRouteTrips
    {allRouteIds}
    {enRouteTrips}
    bind:hoveredRoute
    {mapData}
    {offsets}
    {positions}
  />

  <BusTransitDepartingTrips
    {allRouteIds}
    {departingSoonTrips}
    {departingTripsByCampus}
    bind:hoveredRoute
    {mapData}
    {positions}
  />

  <BusTransitCampusNodes
    campuses={mapData.campuses}
    {positions}
  />
</svg>
