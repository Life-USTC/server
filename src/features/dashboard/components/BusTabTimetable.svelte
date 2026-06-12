<script lang="ts">
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import BusTabRouteTable from "./BusTabRouteTable.svelte";
import BusTabTimetableNotice from "./BusTabTimetableNotice.svelte";

export let bus: DashboardBusData;
export let busApplicableRoutes: BusApplicableRoute[];
export let busCopy: DashboardBusCopy;
export let busNextTripHighlightKey: string | null;
export let busPlannerReady: boolean;
export let busShowsEstimatedHint: boolean;
export let reverseBusStops: () => void;
</script>

<div class="order-2 lg:order-2">
  <div class="grid gap-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Card.Title>{busCopy.dashboardTitle}</Card.Title>
        <Card.Description>
          {bus?.version?.title ?? busCopy.activeVersion}
        </Card.Description>
      </div>
      <Button href="/bus-map" size="lg" variant="outline">{busCopy.transitMap}</Button>
    </div>

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
      <Alert>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>{busCopy.planner.empty}</span>
          <Button
            disabled={!busPlannerReady}
            size="sm"
            type="button"
            variant="outline"
            onclick={reverseBusStops}
          >
            {busCopy.planner.emptyReverseAction}
          </Button>
        </div>
      </Alert>
    {/if}

    <BusTabTimetableNotice
      {bus}
      {busCopy}
      {busShowsEstimatedHint}
    />
  </div>
</div>
