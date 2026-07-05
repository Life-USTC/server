<script lang="ts">
import BusMapLegendPanel from "@/features/bus/components/BusMapLegendPanel.svelte";
import BusMapPageHeader from "@/features/bus/components/BusMapPageHeader.svelte";
import BusMapStatusPanel from "@/features/bus/components/BusMapStatusPanel.svelte";
import BusTransitSvg from "@/features/bus/components/BusTransitSvg.svelte";
import type {
  BusMapCopy,
  BusMapData,
  BusMapDayTypeLabels,
} from "@/features/bus/lib/bus-map-types";
import { buildBusMapViewState } from "@/features/bus/lib/bus-map-view-state";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

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
    dayTypeLabel={busMapView.dayTypeLabel}
    {mapData}
    {refreshMap}
    {refreshing}
    totalTripsForToday={busMapView.totalTripsForToday}
    updatedTime={busMapView.updatedTime}
  />

  {#if !mapData}
    <Empty.Root class="border border-border bg-background py-16">
      <Empty.Header>
        <Empty.Title>{copy.noData}</Empty.Title>
        <Empty.Description>{copy.noDataDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card.Root class="overflow-hidden">
        <Card.Header>
          <Card.Title>{copy.networkOverview}</Card.Title>
          <Card.Description>{copy.networkDescription}</Card.Description>
        </Card.Header>
        <Card.Content class="bg-[#f6f8fa] p-0">
          <ScrollArea orientation="horizontal" class="p-3">
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
          />
          </ScrollArea>
        </Card.Content>
      </Card.Root>

      <aside class="grid content-start gap-4">
        <BusMapStatusPanel
          allRouteIds={busMapView.allRouteIds}
          {copy}
          dayTypeLabel={busMapView.dayTypeLabel}
          departingSoonCount={busMapView.departingSoonCount}
          enRouteCount={busMapView.enRouteCount}
          bind:hoveredRoute
          {mapData}
          nowMinutes={busMapView.nowMinutes}
          updatedTime={busMapView.updatedTime}
        />

        <BusMapLegendPanel
          allRouteIds={busMapView.allRouteIds}
          {copy}
          bind:hoveredRoute
          {mapData}
        />
      </aside>
    </div>
  {/if}
</section>
