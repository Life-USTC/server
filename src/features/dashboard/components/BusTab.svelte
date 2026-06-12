<script lang="ts">
import {
  hasEstimatedBusTimes,
  nextBusTripHighlightKey,
} from "@/features/dashboard/lib/bus";
import { createBusTabState } from "@/features/dashboard/lib/bus-tab-state";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { Alert } from "$lib/components/ui/alert/index.js";
import BusTabSettings from "./BusTabSettings.svelte";
import BusTabTimetable from "./BusTabTimetable.svelte";

export let busCopy: DashboardBusCopy;
export let bus: DashboardBusData | null;
export let savePreferences = false;

let busStateVersion = 0;
let busDayType: "weekday" | "weekend" = "weekday";
let busEndCampusId: number | null = null;
let busPlannerReady = false;
let busShowDepartedTrips = false;
let busStartCampusId: number | null = null;
const state = createBusTabState({
  getBus: () => bus,
  getBusCopy: () => busCopy,
  getSavePreferences: () => savePreferences,
  invalidate: () => {
    busStateVersion += 1;
  },
});
let busApplicableRoutes: ReturnType<typeof state.applicableRoutes> = [];

$: {
  void busStateVersion;
  busApplicableRoutes = bus ? state.applicableRoutes() : [];
  busDayType = state.values.busDayType;
  busEndCampusId = state.values.busEndCampusId;
  busPlannerReady = state.values.busPlannerReady;
  busShowDepartedTrips = state.values.busShowDepartedTrips;
  busStartCampusId = state.values.busStartCampusId;
}
$: busNextTripHighlightKey = nextBusTripHighlightKey(busApplicableRoutes);
$: busShowsEstimatedHint = hasEstimatedBusTimes(
  bus,
  busApplicableRoutes,
  busDayType,
);

$: state.initializeWhenNeeded();
</script>

      <div class="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        {#if bus}
          <BusTabTimetable
            {bus}
            {busApplicableRoutes}
            {busCopy}
            {busNextTripHighlightKey}
            {busPlannerReady}
            {busShowsEstimatedHint}
            reverseBusStops={state.actions.reverseBusStops}
          />

          <BusTabSettings
            {bus}
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
