<script lang="ts">
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
import type { MapViewBox } from "./bus-transit-map-campus-layout";

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
export let viewBox: MapViewBox;

$: mapSizeStyle = [
  `aspect-ratio:${viewBox.width}/${viewBox.height}`,
  `width:min(100%,calc(min(52vh,26rem)*${viewBox.width}/${viewBox.height}))`,
].join(";");
</script>

<svg
  viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
  class="mx-auto block h-auto max-w-full rounded-md border border-border bg-card"
  style={mapSizeStyle}
  preserveAspectRatio="xMidYMid meet"
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
