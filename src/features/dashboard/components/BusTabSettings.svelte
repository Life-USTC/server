<script lang="ts">
import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
import type { BusPreferenceSaveState } from "@/features/dashboard/lib/bus";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
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

<Field.Group class="gap-4">
  <Field.Set>
    <Field.Legend class="sr-only">{busCopy.dashboardTitle}</Field.Legend>
    <Field.Group class="gap-4">
      <BusCampusPickerGroup
        campuses={bus.campuses}
        disabled={!busPlannerReady}
        label={busCopy.planner.start}
        onSelect={selectBusStart}
        selectedCampusId={busStartCampusId}
        testId="bus-start-stop-group"
      />

      <Field.Field>
        <Button
          aria-label={busCopy.planner.reverse}
          class="w-full justify-center"
          disabled={!busPlannerReady}
          type="button"
          onclick={reverseBusStops}
          variant="outline"
        >
          <ArrowLeftRightIcon data-icon="inline-start" />
          {busCopy.planner.reverse}
        </Button>
      </Field.Field>

      <BusCampusPickerGroup
        campuses={bus.campuses}
        disabled={!busPlannerReady}
        label={busCopy.planner.end}
        onSelect={selectBusEnd}
        selectedCampusId={busEndCampusId}
        testId="bus-end-stop-group"
      />
    </Field.Group>
  </Field.Set>

  <Field.Separator />

  <Field.Set>
    <Field.Group class="gap-3">
      <Field.Field>
        <Field.Title id="bus-day-type-label">
          {busCopy.query.dayType}
        </Field.Title>
        <ToggleGroup.Root
          aria-labelledby="bus-day-type-label"
          class="grid w-full grid-cols-2"
          spacing={2}
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
      </Field.Field>

      <Field.Field
        data-disabled={!busPlannerReady ? "true" : undefined}
        orientation="horizontal"
      >
        <Field.Content>
          <Field.Label class="font-normal" for="bus-show-departed-trips">
            {busCopy.query.showDepartedTrips}
          </Field.Label>
        </Field.Content>
        <Switch
          id="bus-show-departed-trips"
          checked={busShowDepartedTrips}
          disabled={!busPlannerReady}
          onCheckedChange={toggleBusDepartedTrips}
        />
      </Field.Field>
    </Field.Group>
  </Field.Set>

  {#if busPreferenceStatus}
    <Field.Description
      aria-live="polite"
      class={cn(
        busPreferenceSaveState === "error"
          ? "text-destructive"
          : undefined,
      )}
      role={busPreferenceSaveState === "error" ? "alert" : "status"}
    >
      {busPreferenceStatus}
    </Field.Description>
  {/if}
</Field.Group>
