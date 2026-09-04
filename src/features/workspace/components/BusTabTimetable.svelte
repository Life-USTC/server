<script lang="ts">
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import type {
  WorkspaceBusCopy,
  WorkspaceBusData,
} from "@/features/workspace/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import BusTabRouteTable from "./BusTabRouteTable.svelte";
import BusTabTimetableNotice from "./BusTabTimetableNotice.svelte";

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
          <h2 class="font-semibold text-lg tracking-normal">
            {busCopy.workspaceTitle}
          </h2>
        </div>
        <Button class="h-11 md:h-8" href="/catalog/bus/map" variant="outline">
          {busCopy.transitMap}
        </Button>
      </div>
    {/if}

    {#if busApplicableRoutes.length > 0}
      <div class="grid min-w-0 gap-6">
        {#each busApplicableRoutes as route}
          <BusTabRouteTable
            {busNextTripHighlightKey}
            {route}
          />
        {/each}
      </div>
    {:else}
      <Empty.Root>
        <Empty.Header>
          <Empty.Description>{busCopy.planner.empty}</Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <Button
            class="h-11 md:h-8"
            disabled={!busPlannerReady}
            type="button"
            variant="outline"
            onclick={reverseBusStops}
          >
            {busCopy.planner.emptyReverseAction}
          </Button>
        </Empty.Content>
      </Empty.Root>
    {/if}

    <BusTabTimetableNotice
      {bus}
      {busCopy}
      {busShowsEstimatedHint}
    />
  </div>
</div>
