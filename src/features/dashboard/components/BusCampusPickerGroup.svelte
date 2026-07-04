<script lang="ts">
import type { BusCampusSummary } from "@/features/bus/lib/bus-timetable-types";
import * as Field from "$lib/components/ui/field/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let campuses: BusCampusSummary[];
export let disabled: boolean;
export let label: string;
export let onSelect: (campusId: number) => void;
export let selectedCampusId: number | null;
export let testId: string;

function selectCampus(value: string) {
  if (!value) return;

  const campusId = Number.parseInt(value, 10);
  if (campuses.some((campus) => campus.id === campusId)) {
    onSelect(campusId);
  }
}
</script>

<Field.Field data-disabled={disabled ? "true" : undefined} data-testid={testId}>
  <Field.Title id={`${testId}-label`}>{label}</Field.Title>
  <ToggleGroup.Root
    aria-labelledby={`${testId}-label`}
    class="grid w-full grid-cols-3"
    spacing={2}
    type="single"
    value={selectedCampusId === null ? "" : String(selectedCampusId)}
    variant="outline"
    onValueChange={selectCampus}
  >
    {#each campuses as campus}
      <ToggleGroup.Item
        class="w-full justify-start"
        {disabled}
        value={String(campus.id)}
      >
        {campus.namePrimary}
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</Field.Field>
