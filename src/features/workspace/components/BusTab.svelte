<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import { onMount } from "svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Collapsible from "#lib/components/ui/collapsible/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import {
  busStopFilterFields,
  filterBusTableRoutes,
} from "@/features/bus/lib/bus-table-filters";
import {
  hasEstimatedBusTimes,
  nextBusTripHighlightKey,
} from "@/features/workspace/lib/bus";
import { createBusTabState } from "@/features/workspace/lib/bus-tab-state";
import type {
  WorkspaceBusCopy,
  WorkspaceBusData,
} from "@/features/workspace/lib/bus-tab-types";
import { apiClient } from "@/lib/api/client";
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/browser/local-storage";
import BusTabCompactSummary from "./BusTabCompactSummary.svelte";
import BusTabSettings from "./BusTabSettings.svelte";
import BusTabTimetable from "./BusTabTimetable.svelte";

const RECENT_BUS_ROUTE_KEY = "life-ustc:recent-bus-route:v1";

export let busCopy: WorkspaceBusCopy;
export let bus: WorkspaceBusData | null;
export let compact = false;
export let savePreferences = false;
export let showPageHeader = false;
export let onPlannerChange: (() => void) | undefined = undefined;

let loadedBus: WorkspaceBusData | null = bus;
let busStateVersion = 0;
let busDayType: "weekday" | "saturday" | "sunday" = "weekday";
let busPlannerReady = false;
let timetableOpen = true;
let plannerControlsOpen = false;
let tableDraft: Record<string, string> = {};
let tableFilters: Record<string, string> = {};
let plannerDraft = {
  startCampusId: null as number | null,
  endCampusId: null as number | null,
  dayType: "weekday" as "weekday" | "saturday" | "sunday",
  showDepartedTrips: false,
};
let draftInitialized = false;
const formId = "bus-table-filters";
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
    const result = await apiClient.GET<WorkspaceBusData>("/api/catalog/bus");
    if (!result.response.ok || !result.data) {
      busLoadFailed = true;
      return;
    }
    loadedBus = result.data;
    state.initializeWhenNeeded();
    restoreRecentRoute();
    synchronizeDraft();
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

function synchronizeDraft() {
  plannerDraft = {
    startCampusId: state.values.busStartCampusId,
    endCampusId: state.values.busEndCampusId,
    dayType: state.values.busDayType,
    showDepartedTrips: state.values.busShowDepartedTrips,
  };
  draftInitialized = true;
}

function updateFilters(patch: Record<string, string>) {
  onPlannerChange?.();
  tableDraft = { ...tableDraft, ...patch };
}

function reverseBusStops() {
  onPlannerChange?.();
  plannerDraft = {
    ...plannerDraft,
    startCampusId: plannerDraft.endCampusId,
    endCampusId: plannerDraft.startCampusId,
  };
  plannerControlsOpen = true;
}

function selectBusEnd(campusId: number) {
  onPlannerChange?.();
  plannerDraft = {
    ...plannerDraft,
    endCampusId: campusId,
    startCampusId:
      plannerDraft.startCampusId === campusId
        ? plannerDraft.endCampusId
        : plannerDraft.startCampusId,
  };
}

function selectBusStart(campusId: number) {
  onPlannerChange?.();
  plannerDraft = {
    ...plannerDraft,
    startCampusId: campusId,
    endCampusId:
      plannerDraft.endCampusId === campusId
        ? plannerDraft.startCampusId
        : plannerDraft.endCampusId,
  };
}

function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  if (!busPlannerReady) return;
  onPlannerChange?.();
  tableFilters = { ...tableDraft };
  state.actions.applyBusFilters(plannerDraft);
  saveRecentRoute();
  plannerControlsOpen = false;
}

function clearFilters() {
  onPlannerChange?.();
  tableDraft = {};
  synchronizeDraft();
}

onMount(() => {
  const cleanup = state.actions.mount();
  restoreRecentRoute();
  synchronizeDraft();
  void loadPublicBusData();
  return cleanup;
});

$: {
  void busStateVersion;
  if (bus) loadedBus = bus;
  state.initializeWhenNeeded();
  busApplicableRoutes = loadedBus
    ? filterBusTableRoutes(state.applicableRoutes(), tableFilters)
    : [];
  busDayType = state.values.busDayType;
  busPlannerReady = state.values.busPlannerReady;
  if (!draftInitialized && loadedBus) synchronizeDraft();
}
$: busNextTripHighlightKey = nextBusTripHighlightKey(busApplicableRoutes);
$: busShowsEstimatedHint = hasEstimatedBusTimes(
  loadedBus,
  busApplicableRoutes,
  busDayType,
);
</script>

{#snippet plannerControls()}
  {#if loadedBus}
    <TableColumnHeader label={busCopy.changeRoute} active={true} bind:open={plannerControlsOpen}>
      <BusTabSettings
        bus={loadedBus}
        idPrefix="bus-settings"
        {busCopy}
        busDayType={plannerDraft.dayType}
        busEndCampusId={plannerDraft.endCampusId}
        {busPlannerReady}
        busShowDepartedTrips={plannerDraft.showDepartedTrips}
        busStartCampusId={plannerDraft.startCampusId}
        {reverseBusStops}
        {selectBusEnd}
        {selectBusStart}
        setBusDayType={(dayType) => { onPlannerChange?.(); plannerDraft = { ...plannerDraft, dayType }; }}
        toggleBusDepartedTrips={() => { onPlannerChange?.(); plannerDraft = { ...plannerDraft, showDepartedTrips: !plannerDraft.showDepartedTrips }; }}
      />
    </TableColumnHeader>
  {/if}
{/snippet}

<div class="grid min-w-0 gap-5">
  {#if showPageHeader}
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="grid gap-1">
        <h2 class="font-semibold text-xl tracking-normal">{busCopy.workspaceTitle}</h2>
      </div>
    </div>
  {/if}

  {#if loadedBus}
    <div data-testid="bus-responsive-planner" class="grid min-w-0 gap-3">
      {#if compact}
        <div class="lg:hidden">
          <BusTabCompactSummary {busApplicableRoutes} {busCopy} {busPlannerReady} {reverseBusStops} />
        </div>
      {/if}
      <form id={formId} onsubmit={applyFilters} data-slot="collection-header">
        <Field.Group class="flex-row flex-wrap items-center gap-3">
          {@render plannerControls()}
          <TableFieldFilter label={busCopy.planner.routes} fields={[{ name: "routeId", label: busCopy.planner.routes, options: loadedBus.routes.map((route) => ({ value: String(route.id), label: route.descriptionPrimary })) }]} values={tableDraft} onchange={updateFilters} labels={busCopy.tableFilters} idPrefix="bus-routes" {formId} />
          <TableColumnHeader label={busCopy.route.stops} active={Object.entries(tableDraft).some(([key, value]) => /^(stop|time)\d+$/.test(key) && Boolean(value))}>
            <TableFilterFields fields={loadedBus.campuses.flatMap((campus) => busStopFilterFields(campus.id, campus.namePrimary, busCopy))} values={tableDraft} onchange={updateFilters} labels={busCopy.tableFilters} idPrefix="bus-stops" {formId} />
          </TableColumnHeader>
          <Button type="submit" class="h-11 md:h-8" disabled={!busPlannerReady}>{busCopy.applyFilters}</Button>
          <Button type="button" variant="ghost" class="h-11 md:h-8" onclick={clearFilters}>{busCopy.clear}</Button>
        </Field.Group>
      </form>
      <Collapsible.Root bind:open={timetableOpen} class="group/full-timetable">
        {#if compact}
          <Collapsible.Trigger>
            {#snippet child({ props })}
              <Button {...props} class="h-11 w-full justify-between lg:hidden" variant="outline">
                {timetableOpen ? busCopy.hideFullTimetable : busCopy.fullTimetable}
                <ChevronDownIcon data-icon="inline-end" class="transition-transform group-data-[state=open]/full-timetable:rotate-180" />
              </Button>
            {/snippet}
          </Collapsible.Trigger>
        {/if}
        <Collapsible.Content class="data-[state=closed]:hidden lg:!block" forceMount>
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
              filterValues={tableDraft}
              onFilterChange={updateFilters}
              {formId}
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
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
    <div class="grid gap-3" aria-label={busCopy.workspaceTitle} aria-busy="true">
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
