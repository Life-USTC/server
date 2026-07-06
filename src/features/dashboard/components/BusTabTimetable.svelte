<script lang="ts">
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import BusTabRouteTable from "./BusTabRouteTable.svelte";
import BusTabTimetableNotice from "./BusTabTimetableNotice.svelte";

export let bus: DashboardBusData;
export let busApplicableRoutes: BusApplicableRoute[];
export let busCopy: DashboardBusCopy;
export let busNextTripHighlightKey: string | null;
export let busPlannerReady: boolean;
export let busShowsEstimatedHint: boolean;
export let reverseBusStops: () => void;
export let showHeader = true;
</script>

<div>
  <div class="grid gap-5">
    {#if showHeader}
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-lg tracking-normal">
            {busCopy.dashboardTitle}
          </h2>
          <p class="text-muted-foreground text-sm">
            {bus?.version?.title ?? busCopy.activeVersion}
          </p>
        </div>
        <Button href="/bus-map" size="lg" variant="outline">{busCopy.transitMap}</Button>
      </div>
    {/if}

    {#if busApplicableRoutes.length > 0}
      <div class="grid gap-4">
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
            disabled={!busPlannerReady}
            size="sm"
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
