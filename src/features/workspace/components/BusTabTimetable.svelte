<script lang="ts">
import EmptyState from "#lib/components/EmptyState.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import type {
  WorkspaceBusCopy,
  WorkspaceBusData,
} from "@/features/workspace/lib/bus-tab-types";
import BusTabRoutesTable from "./BusTabRoutesTable.svelte";
import BusTabTimetableNotice from "./BusTabTimetableNotice.svelte";

export let filterValues: Record<string, string>;
export let onFilterChange: (patch: Record<string, string>) => void;
export let formId: string;
export let bus: WorkspaceBusData;
export let busApplicableRoutes: BusApplicableRoute[];
export let busCopy: WorkspaceBusCopy;
export let busNextTripHighlightKey: string | null;
export let busPlannerReady: boolean;
export let busShowsEstimatedHint: boolean;
export let reverseBusStops: () => void;
export let showHeader = false;
</script>

<div class="min-w-0">
  <div class="grid min-w-0 gap-4">
    {#if showHeader}
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="section-heading">
            {busCopy.workspaceTitle}
          </h2>
        </div>
        <Button href="/catalog/bus/map" variant="outline">
          {busCopy.transitMap}
        </Button>
      </div>
    {/if}

    <BusTabRoutesTable
      {busNextTripHighlightKey}
      routes={busApplicableRoutes}
      label={busCopy.workspaceTitle}
      {filterValues}
      {onFilterChange}
      {formId}
      {busCopy}
    >
      {#snippet empty()}
        <EmptyState description={busCopy.planner.empty}>
          <Button disabled={!busPlannerReady} variant="outline" onclick={reverseBusStops}>
            {busCopy.planner.emptyReverseAction}
          </Button>
        </EmptyState>
      {/snippet}
    </BusTabRoutesTable>

    <BusTabTimetableNotice
      {bus}
      {busCopy}
      {busShowsEstimatedHint}
    />
  </div>
</div>
