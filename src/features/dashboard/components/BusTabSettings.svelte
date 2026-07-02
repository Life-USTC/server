<script lang="ts">
import type { BusPreferenceSaveState } from "@/features/dashboard/lib/bus";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import ArrowLeftRight from "$lib/components/icons/arrow-left-right.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Switch } from "$lib/components/ui/switch/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import { cn } from "$lib/utils.js";
import BusCampusPickerGroup from "./BusCampusPickerGroup.svelte";

export let bus: DashboardBusData;
export let busCopy: DashboardBusCopy;
export let busDayType: "weekday" | "weekend";
export let busEndCampusId: number | null;
export let busPlannerReady: boolean;
export let busPreferenceSaveState: BusPreferenceSaveState;
export let busPreferenceStatus: string;
export let busShowDepartedTrips: boolean;
export let busStartCampusId: number | null;
export let reverseBusStops: () => void;
export let selectBusEnd: (campusId: number) => void;
export let selectBusStart: (campusId: number) => void;
export let setBusDayType: (dayType: "weekday" | "weekend") => void;
export let toggleBusDepartedTrips: () => void;
</script>

<Card.Root>
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
      <ToggleGroup.Root
        aria-label={busCopy.query.dayType}
        class="origin-left scale-90"
        type="single"
        value={busDayType}
        variant="outline"
        onValueChange={(value) => {
          if (value === "weekday" || value === "weekend") setBusDayType(value);
        }}
      >
        <ToggleGroup.Item
          disabled={!busPlannerReady}
          value="weekday"
        >
          {busCopy.dayType.weekday}
        </ToggleGroup.Item>
        <ToggleGroup.Item
          disabled={!busPlannerReady}
          value="weekend"
        >
          {busCopy.dayType.weekend}
        </ToggleGroup.Item>
      </ToggleGroup.Root>
      <Field.Field class="ml-auto w-auto" orientation="horizontal">
        <Field.Content>
          <Field.Label class="font-normal" for="bus-show-departed-trips">
            {busCopy.query.showDepartedTrips}
          </Field.Label>
        </Field.Content>
        <Switch
          class="border-base-300 data-unchecked:bg-base-300"
          id="bus-show-departed-trips"
          checked={busShowDepartedTrips}
          disabled={!busPlannerReady}
          onCheckedChange={toggleBusDepartedTrips}
        />
      </Field.Field>
    </div>
    {#if busPreferenceStatus}
      <p
        aria-live="polite"
        class={cn(
          "text-sm",
          busPreferenceSaveState === "error"
            ? "text-error"
            : "text-base-content/60",
        )}
        role={busPreferenceSaveState === "error" ? "alert" : "status"}
      >
        {busPreferenceStatus}
      </p>
    {/if}
  </Card.Content>
</Card.Root>
