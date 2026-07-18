<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import { onMount } from "svelte";
import {
  type BusPreferenceSaveState,
  busPreferenceStatusText,
  hasEstimatedBusTimes,
  nextBusTripHighlightKey,
} from "@/features/dashboard/lib/bus";
import { createBusTabState } from "@/features/dashboard/lib/bus-tab-state";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { apiClient } from "@/lib/api/client";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import BusTabCompactSummary from "./BusTabCompactSummary.svelte";
import BusTabSettings from "./BusTabSettings.svelte";
import BusTabTimetable from "./BusTabTimetable.svelte";

const RECENT_BUS_ROUTE_KEY = "life-ustc:recent-bus-route:v1";

export let busCopy: DashboardBusCopy;
export let bus: DashboardBusData | null;
export let compact = false;
export let savePreferences = false;

let loadedBus: DashboardBusData | null = bus;
let busStateVersion = 0;
let busDayType: "weekday" | "weekend" = "weekday";
let busEndCampusId: number | null = null;
let busPlannerReady = false;
let busPreferenceSaveError = "";
let busPreferenceSaveState: BusPreferenceSaveState = "idle";
let busPreferenceStatus = "";
let busShowDepartedTrips = false;
let busStartCampusId: number | null = null;
let routeControlsOpen = false;
let timetableOpen = false;
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
  const result = await apiClient.GET<DashboardBusData>("/api/bus");
  if (!result.response.ok || !result.data) return;
  loadedBus = result.data;
  state.initializeWhenNeeded();
  restoreRecentRoute();
}

function restoreRecentRoute() {
  if (savePreferences || !loadedBus) return;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(RECENT_BUS_ROUTE_KEY) ?? "null",
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
    window.localStorage.removeItem(RECENT_BUS_ROUTE_KEY);
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

  window.localStorage.setItem(
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
  busPreferenceSaveError = state.values.busPreferenceSaveError;
  busPreferenceSaveState = state.values.busPreferenceSaveState;
  busShowDepartedTrips = state.values.busShowDepartedTrips;
  busStartCampusId = state.values.busStartCampusId;
}
$: busPreferenceStatus = savePreferences
  ? busPreferenceStatusText({
      autosaveHint: busCopy.preferences.autosaveHint,
      error: busPreferenceSaveError,
      saveFailed: busCopy.preferences.saveFailed,
      saved: busCopy.preferences.saved,
      saving: busCopy.preferences.saving,
      state: busPreferenceSaveState,
    })
  : "";
$: busNextTripHighlightKey = nextBusTripHighlightKey(busApplicableRoutes);
$: busShowsEstimatedHint = hasEstimatedBusTimes(
  loadedBus,
  busApplicableRoutes,
  busDayType,
);
</script>

<div class="grid gap-5">
  {#if !compact}
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="grid gap-1">
        <h2 class="font-semibold text-xl tracking-normal">{busCopy.dashboardTitle}</h2>
      </div>
      <Button href="/bus-map" size="lg" variant="outline">{busCopy.transitMap}</Button>
    </div>
  {/if}

  {#if loadedBus}
    {#if compact}
      <div class="grid gap-3">
        <BusTabCompactSummary
          {busApplicableRoutes}
          {busCopy}
          {busPlannerReady}
          {reverseBusStops}
        />

        <Collapsible.Root bind:open={routeControlsOpen} class="group/route-controls">
          <Collapsible.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="w-full justify-between"
                size="lg"
                variant="outline"
              >
                {routeControlsOpen ? busCopy.hideRouteControls : busCopy.changeRoute}
                <ChevronDownIcon
                  data-icon="inline-end"
                  class="transition-transform group-data-[state=open]/route-controls:rotate-180"
                />
              </Button>
            {/snippet}
          </Collapsible.Trigger>
          <Collapsible.Content>
            <div class="pt-4">
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
                {busPreferenceSaveState}
                {busPreferenceStatus}
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
                class="w-full justify-between"
                size="lg"
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
          <Collapsible.Content>
            <div class="pt-4">
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
      <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
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
        {busPreferenceSaveState}
        {busPreferenceStatus}
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
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Title>{busCopy.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/if}
</div>
