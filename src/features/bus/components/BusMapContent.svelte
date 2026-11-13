<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import BusMapPageHeader from "@/features/bus/components/BusMapPageHeader.svelte";
import BusMapVehicleGlyph from "@/features/bus/components/BusMapVehicleGlyph.svelte";
import BusTransitSvg from "@/features/bus/components/BusTransitSvg.svelte";
import type {
  BusMapCopy,
  BusMapData,
  BusMapDayTypeLabels,
} from "@/features/bus/lib/bus-map-types";
import { buildBusMapViewState } from "@/features/bus/lib/bus-map-view-state";

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
  .bus-map-page {
    /* Mobile topbar includes its border; md has an explicit border-box height.
       Also reserve content padding and the shared primary bar/safe area. */
    height: calc(100dvh - 3.5rem - 1px - 2rem - 4rem - env(safe-area-inset-bottom));
    min-height: 20rem;
  }

  .bus-map-canvas {
    container-type: size;
  }

  @media (min-width: 768px) {
    .bus-map-page {
      height: calc(100dvh - 3rem - 2rem - 4rem - env(safe-area-inset-bottom));
    }
  }

  @media (min-width: 1024px) {
    .bus-map-page {
      height: calc(100dvh - 3rem - 2rem);
    }
  }
</style>

<section class="bus-map-page grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
  <BusMapPageHeader
    {copy}
    {refreshMap}
    {refreshing}
  />

  <div class="grid min-w-0 gap-2 text-sm" data-testid="bus-map-legend">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <strong>{copy.legend.title}</strong>
      <span class="inline-flex items-center gap-2"><span class="h-0.5 w-5 bg-blue-600" aria-hidden="true"></span>{copy.legend.route}</span>
      <span class="inline-flex items-center gap-2"><svg width="24" height="16" viewBox="-12 -8 24 16" aria-hidden="true"><BusMapVehicleGlyph x={0} y={0} angle={0} color="#0969da" /></svg>{copy.legend.enRoute}</span>
      <span class="inline-flex items-center gap-2"><svg width="24" height="16" viewBox="-12 -8 24 16" aria-hidden="true"><BusMapVehicleGlyph x={0} y={0} angle={0} color="#0969da" opacity={0.85} /></svg>{copy.legend.departingSoon}</span>
      <Button href="/catalog/bus" variant="link" size="sm" class="h-auto px-0">{copy.backToBus}</Button>
    </div>
    <p class="text-muted-foreground">{copy.interactionHint}</p>
  </div>

  {#if !mapData}
    <Empty.Root class="py-16">
      <Empty.Header>
        <Empty.Title>{copy.noData}</Empty.Title>
        <Empty.Description>{copy.noDataDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="bus-map-canvas flex min-h-0 min-w-0 items-start justify-center">
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
    </div>
  {/if}
</section>
