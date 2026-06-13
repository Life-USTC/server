<script lang="ts">
import { onMount } from "svelte";
import {
  hasEstimatedBusTimes,
  nextBusTripHighlightKey,
} from "@/features/dashboard/lib/bus";
import { createBusTabState } from "@/features/dashboard/lib/bus-tab-state";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { browser } from "$app/environment";
import { Alert } from "$lib/components/ui/alert/index.js";
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
  const response = await fetch("/api/bus");
  if (!response.ok) return;
  loadedBus = (await response.json()) as DashboardBusData;
  state.initializeWhenNeeded();
}

if (browser) {
  onMount(() => {
    const cleanup = state.actions.mount();
    void loadPublicBusData();
    return cleanup;
  });
}

$: {
  void busStateVersion;
  if (bus) loadedBus = bus;
  busApplicableRoutes = browser && loadedBus ? state.applicableRoutes() : [];
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

      <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        {#if loadedBus && browser}
          <BusTabTimetable
            bus={loadedBus}
            {busApplicableRoutes}
            {busCopy}
            {busNextTripHighlightKey}
            {busPlannerReady}
            {busShowsEstimatedHint}
            reverseBusStops={state.actions.reverseBusStops}
          />

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
            toggleBusDepartedTrips={state.actions.toggleBusDepartedTrips}
          />
        {:else}
          <Alert>{busCopy.empty}</Alert>
        {/if}
      </div>
