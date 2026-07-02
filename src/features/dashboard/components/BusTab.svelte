<script lang="ts">
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
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import BusTabSettings from "./BusTabSettings.svelte";
import BusTabTimetable from "./BusTabTimetable.svelte";

export let busCopy: DashboardBusCopy;
export let bus: DashboardBusData | null;
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
}

onMount(() => {
  const cleanup = state.actions.mount();
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

<section class="grid gap-5">
  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div class="grid gap-1">
      <h2 class="font-semibold text-xl tracking-normal">{busCopy.dashboardTitle}</h2>
      <p class="text-base-content/60 text-sm">
        {loadedBus?.version?.title ?? busCopy.activeVersion}
      </p>
    </div>
    <Button href="/bus-map" size="lg" variant="outline">{busCopy.transitMap}</Button>
  </div>

  <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
    {#if loadedBus}
      <BusTabSettings
        bus={loadedBus}
        {busCopy}
        {busDayType}
        {busEndCampusId}
        {busPlannerReady}
        {busShowDepartedTrips}
        {busStartCampusId}
        reverseBusStops={state.actions.reverseBusStops}
        selectBusEnd={state.actions.selectBusEnd}
        selectBusStart={state.actions.selectBusStart}
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
        reverseBusStops={state.actions.reverseBusStops}
        showHeader={false}
      />
    {:else}
      <Alert>{busCopy.empty}</Alert>
    {/if}
  </div>
</section>
