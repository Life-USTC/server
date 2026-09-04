<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import { onMount } from "svelte";
import {
  hasEstimatedBusTimes,
  nextBusTripHighlightKey,
} from "@/features/workspace/lib/bus";
import { createBusTabState } from "@/features/workspace/lib/bus-tab-state";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/workspace/lib/bus-tab-types";
import { apiClient } from "@/lib/api/client";
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import BusTabCompactSummary from "./BusTabCompactSummary.svelte";
import BusTabSettings from "./BusTabSettings.svelte";
import BusTabTimetable from "./BusTabTimetable.svelte";

const RECENT_BUS_ROUTE_KEY = "life-ustc:recent-bus-route:v1";

export let busCopy: DashboardBusCopy;
export let bus: DashboardBusData | null;
export let compact = false;
export let savePreferences = false;
export let showPageHeader = false;

let loadedBus: DashboardBusData | null = bus;
let busStateVersion = 0;
let busDayType: "weekday" | "saturday" | "sunday" = "weekday";
let busEndCampusId: number | null = null;
let busPlannerReady = false;
let busShowDepartedTrips = false;
let busStartCampusId: number | null = null;
let routeControlsOpen = false;
let timetableOpen = true;
let busLoading = !bus;
let busLoadFailed = false;
const state = createBusTabState({
  getBus: () => loadedBus,
  getBusCopy: () => busCopy,
  getSavePreferences: () => savePreferences,
  invalidate: () => {
    busStateVersion += 1;
  },
});
let busApplicableRoutes: ReturnType<typeof state.applicableRoutes> = [];

async function loadPublicBusData() {
  if (loadedBus) return;
  busLoading = true;
  busLoadFailed = false;
  try {
    const result = await apiClient.GET<DashboardBusData>("/api/catalog/bus");
    if (!result.response.ok || !result.data) {
      busLoadFailed = true;
      return;
    }
    loadedBus = result.data;
    state.initializeWhenNeeded();
    restoreRecentRoute();
  } catch {
    busLoadFailed = true;
  } finally {
    busLoading = false;
  }
}

function restoreRecentRoute() {
  if (savePreferences || !loadedBus) return;

  try {
    const stored = JSON.parse(
      getLocalStorageItem(RECENT_BUS_ROUTE_KEY) ?? "null",
    ) as {
      endCampusId?: unknown;
      startCampusId?: unknown;
    } | null;
    if (
      typeof stored?.startCampusId !== "number" ||
      typeof stored.endCampusId !== "number"
    ) {
      return;
    }

    const hasRoute = loadedBus.routes.some((route) => {
      const startIndex = route.stops.findIndex(
        (stop) => stop.campus.id === stored.startCampusId,
      );
      const endIndex = route.stops.findIndex(
        (stop) => stop.campus.id === stored.endCampusId,
      );
      return startIndex >= 0 && endIndex > startIndex;
    });
    if (!hasRoute) return;

    state.actions.selectBusStart(stored.startCampusId);
    state.actions.selectBusEnd(stored.endCampusId);
  } catch {
    removeLocalStorageItem(RECENT_BUS_ROUTE_KEY);
  }
}

function saveRecentRoute() {
  if (
    savePreferences ||
    state.values.busStartCampusId == null ||
    state.values.busEndCampusId == null
  ) {
    return;
  }

  setLocalStorageItem(
    RECENT_BUS_ROUTE_KEY,
    JSON.stringify({
      endCampusId: state.values.busEndCampusId,
      startCampusId: state.values.busStartCampusId,
    }),
  );
}

function reverseBusStops() {
  state.actions.reverseBusStops();
  saveRecentRoute();
}

function selectBusEnd(campusId: number) {
  state.actions.selectBusEnd(campusId);
  saveRecentRoute();
}

function selectBusStart(campusId: number) {
  state.actions.selectBusStart(campusId);
  saveRecentRoute();
}

onMount(() => {
  const cleanup = state.actions.mount();
  restoreRecentRoute();
  void loadPublicBusData();
  return cleanup;
});

$: {
  void busStateVersion;
  if (bus) loadedBus = bus;
  state.initializeWhenNeeded();
  busApplicableRoutes = loadedBus ? state.applicableRoutes() : [];
  busDayType = state.values.busDayType;
  busEndCampusId = state.values.busEndCampusId;
  busPlannerReady = state.values.busPlannerReady;
  busShowDepartedTrips = state.values.busShowDepartedTrips;
  busStartCampusId = state.values.busStartCampusId;
}
$: busNextTripHighlightKey = nextBusTripHighlightKey(busApplicableRoutes);
$: busShowsEstimatedHint = hasEstimatedBusTimes(
  loadedBus,
  busApplicableRoutes,
  busDayType,
);
</script>

<div class="grid min-w-0 gap-5">
  {#if showPageHeader}
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="grid gap-1">
        <h2 class="font-semibold text-xl tracking-normal">{busCopy.dashboardTitle}</h2>
      </div>
    </div>
  {/if}

  {#if loadedBus}
    {#if compact}
      <div
        data-testid="bus-responsive-planner"
        class="grid min-w-0 gap-3 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-4"
      >
        <div class="lg:col-span-2 lg:hidden">
          <BusTabCompactSummary
            {busApplicableRoutes}
            {busCopy}
            {busPlannerReady}
            {reverseBusStops}
          />
        </div>

        <Collapsible.Root bind:open={routeControlsOpen} class="group/route-controls">
          <Collapsible.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="h-11 w-full justify-between lg:hidden"
                variant="outline"
              >
                {routeControlsOpen
                  ? busCopy.hideRouteControls
                  : busCopy.changeRoute}
                <ChevronDownIcon
                  data-icon="inline-end"
                  class="transition-transform group-data-[state=open]/route-controls:rotate-180"
                />
              </Button>
            {/snippet}
          </Collapsible.Trigger>
          <Collapsible.Content
            class="data-[state=closed]:hidden lg:!block"
            forceMount
          >
            <div class="min-w-0 pt-3 lg:pt-0">
              <BusTabSettings
                bus={loadedBus}
                {busCopy}
                {busDayType}
                {busEndCampusId}
                {busPlannerReady}
                {busShowDepartedTrips}
                {busStartCampusId}
                {reverseBusStops}
                {selectBusEnd}
                {selectBusStart}
                setBusDayType={state.actions.setBusDayType}
                toggleBusDepartedTrips={state.actions.toggleBusDepartedTrips}
              />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>

        <Collapsible.Root bind:open={timetableOpen} class="group/full-timetable">
          <Collapsible.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="h-11 w-full justify-between lg:hidden"
                variant="outline"
              >
                {timetableOpen ? busCopy.hideFullTimetable : busCopy.fullTimetable}
                <ChevronDownIcon
                  data-icon="inline-end"
                  class="transition-transform group-data-[state=open]/full-timetable:rotate-180"
                />
              </Button>
            {/snippet}
          </Collapsible.Trigger>
          <Collapsible.Content
            class="data-[state=closed]:hidden lg:!block"
            forceMount
          >
            <div class="min-w-0 pt-3 lg:pt-0">
              <BusTabTimetable
                bus={loadedBus}
                {busApplicableRoutes}
                {busCopy}
                {busNextTripHighlightKey}
                {busPlannerReady}
                {busShowsEstimatedHint}
                {reverseBusStops}
                showHeader={false}
              />
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    {:else}
      <div class="grid min-w-0 gap-3 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-4">
        <BusTabSettings
          bus={loadedBus}
          {busCopy}
          {busDayType}
          {busEndCampusId}
          {busPlannerReady}
          {busShowDepartedTrips}
          {busStartCampusId}
          {reverseBusStops}
          {selectBusEnd}
          {selectBusStart}
          setBusDayType={state.actions.setBusDayType}
          toggleBusDepartedTrips={state.actions.toggleBusDepartedTrips}
        />

        <BusTabTimetable
          bus={loadedBus}
          {busApplicableRoutes}
          {busCopy}
          {busNextTripHighlightKey}
          {busPlannerReady}
          {busShowsEstimatedHint}
          {reverseBusStops}
          showHeader={false}
        />
      </div>
    {/if}
  {:else if busLoadFailed}
    <Empty.Root>
      <Empty.Header>
        <Empty.Title>{busCopy.loadFailed}</Empty.Title>
      </Empty.Header>
      <Empty.Content>
        <Button type="button" variant="outline" onclick={() => void loadPublicBusData()}>
          {busCopy.retry}
        </Button>
      </Empty.Content>
    </Empty.Root>
  {:else if busLoading}
    <div class="grid gap-3" aria-label={busCopy.dashboardTitle} aria-busy="true">
      <Skeleton class="h-12 w-full" />
      <Skeleton class="h-48 w-full" />
    </div>
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Title>{busCopy.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/if}
</div>
