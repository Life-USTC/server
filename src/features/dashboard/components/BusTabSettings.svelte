<script lang="ts">
import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Switch } from "$lib/components/ui/switch/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import BusCampusPickerGroup from "./BusCampusPickerGroup.svelte";

export let bus: DashboardBusData;
export let busCopy: DashboardBusCopy;
export let busDayType: "weekday" | "saturday" | "sunday";
export let busEndCampusId: number | null;
export let busPlannerReady: boolean;
export let busShowDepartedTrips: boolean;
export let busStartCampusId: number | null;
export let reverseBusStops: () => void;
export let selectBusEnd: (campusId: number) => void;
export let selectBusStart: (campusId: number) => void;
export let setBusDayType: (dayType: "weekday" | "saturday" | "sunday") => void;
export let toggleBusDepartedTrips: () => void;
</script>

<Field.Group class="gap-3">
  <Field.Set>
    <Field.Legend class="sr-only">{busCopy.dashboardTitle}</Field.Legend>
    <Field.Group class="gap-3">
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
          class="h-11 w-full justify-center md:h-8"
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
          class="grid w-full grid-cols-3"
          spacing={2}
          type="single"
          value={busDayType}
          variant="outline"
          onValueChange={(value) => {
            if (
              value === "weekday" ||
              value === "saturday" ||
              value === "sunday"
            ) {
              setBusDayType(value);
            }
          }}
        >
          <ToggleGroup.Item
            class="h-11 md:h-8"
            disabled={!busPlannerReady}
            value="weekday"
          >
            {busCopy.dayType.weekday}
          </ToggleGroup.Item>
          <ToggleGroup.Item
            class="h-11 md:h-8"
            disabled={!busPlannerReady}
            value="saturday"
          >
            {busCopy.dayType.saturday}
          </ToggleGroup.Item>
          <ToggleGroup.Item
            class="h-11 md:h-8"
            disabled={!busPlannerReady}
            value="sunday"
          >
            {busCopy.dayType.sunday}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </Field.Field>

      <Field.Field
        data-disabled={!busPlannerReady ? "true" : undefined}
        orientation="horizontal"
      >
        <Field.Content>
          <Field.Label for="bus-show-departed-trips">
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
</Field.Group>
