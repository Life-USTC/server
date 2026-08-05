<script lang="ts">
import BusMapPageHeader from "@/features/bus/components/BusMapPageHeader.svelte";
import BusTransitSvg from "@/features/bus/components/BusTransitSvg.svelte";
import type {
  BusMapCopy,
  BusMapData,
  BusMapDayTypeLabels,
} from "@/features/bus/lib/bus-map-types";
import { buildBusMapViewState } from "@/features/bus/lib/bus-map-view-state";
import * as Empty from "$lib/components/ui/empty/index.js";

export let copy: BusMapCopy;
export let dayTypeLabels: BusMapDayTypeLabels;
export let locale: string;
export let mapData: BusMapData | null;
export let refreshing: boolean;
export let refreshMap: () => void | Promise<void>;

let hoveredRoute: number | null = null;
$: busMapView = buildBusMapViewState(mapData, dayTypeLabels, locale);
</script>

<style>
  @keyframes -global-dash-march {
    to {
      stroke-dashoffset: -12;
    }
  }
</style>

<section class="grid gap-5">
  <BusMapPageHeader
    {copy}
    {refreshMap}
    {refreshing}
  />

  {#if !mapData}
    <Empty.Root class="py-16">
      <Empty.Header>
        <Empty.Title>{copy.noData}</Empty.Title>
        <Empty.Description>{copy.noDataDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <BusTransitSvg
      activeRouteIds={busMapView.activeRouteIds}
      allRouteIds={busMapView.allRouteIds}
      {copy}
      departingSoonTrips={busMapView.departingSoonTrips}
      departingTripsByCampus={busMapView.departingTripsByCampus}
      enRouteTrips={busMapView.enRouteTrips}
      bind:hoveredRoute
      {mapData}
      offsets={busMapView.offsets}
      positions={busMapView.positions}
      routePaths={busMapView.routePaths}
      viewBox={busMapView.viewBox}
    />
  {/if}
</section>
