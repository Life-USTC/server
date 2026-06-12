<script lang="ts">
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import ArrowLeftRight from "$lib/components/icons/arrow-left-right.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import BusCampusPickerGroup from "./BusCampusPickerGroup.svelte";

export let bus: DashboardBusData;
export let busCopy: DashboardBusCopy;
export let busDayType: "weekday" | "weekend";
export let busEndCampusId: number | null;
export let busPlannerReady: boolean;
export let busShowDepartedTrips: boolean;
export let busStartCampusId: number | null;
export let reverseBusStops: () => void;
export let selectBusEnd: (campusId: number) => void;
export let selectBusStart: (campusId: number) => void;
export let setBusDayType: (dayType: "weekday" | "weekend") => void;
export let toggleBusDepartedTrips: () => void;
</script>

<Card.Root class="order-1 lg:order-1">
  <Card.Content class="grid gap-4 pt-5">
    <div class="grid gap-4">
      <BusCampusPickerGroup
        campuses={bus.campuses}
        disabled={!busPlannerReady}
        label={busCopy.planner.start}
        onSelect={selectBusStart}
        selectedCampusId={busStartCampusId}
        testId="bus-start-stop-group"
      />

      <div class="flex justify-center">
        <Button
          aria-label={busCopy.planner.reverse}
          class="w-full justify-center"
          disabled={!busPlannerReady}
          type="button"
          onclick={reverseBusStops}
          title={busCopy.planner.reverse}
          variant="outline"
        >
          <ArrowLeftRight />
          {busCopy.planner.reverse}
        </Button>
      </div>

      <BusCampusPickerGroup
        campuses={bus.campuses}
        disabled={!busPlannerReady}
        label={busCopy.planner.end}
        onSelect={selectBusEnd}
        selectedCampusId={busEndCampusId}
        testId="bus-end-stop-group"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 border-t border-base-300 pt-4">
      <Tabs.List aria-label={busCopy.query.dayType} class="scale-90 origin-left">
        <Tabs.Button
          disabled={!busPlannerReady}
          selected={busDayType === "weekday"}
          onclick={() => setBusDayType("weekday")}
        >
          {busCopy.dayType.weekday}
        </Tabs.Button>
        <Tabs.Button
          disabled={!busPlannerReady}
          selected={busDayType === "weekend"}
          onclick={() => setBusDayType("weekend")}
        >
          {busCopy.dayType.weekend}
        </Tabs.Button>
      </Tabs.List>
      <label class="ml-auto flex items-center gap-2 text-sm">
        <Checkbox
          checked={busShowDepartedTrips}
          disabled={!busPlannerReady}
          onchange={toggleBusDepartedTrips}
        />
        <span>{busCopy.query.showDepartedTrips}</span>
      </label>
    </div>
  </Card.Content>
</Card.Root>
