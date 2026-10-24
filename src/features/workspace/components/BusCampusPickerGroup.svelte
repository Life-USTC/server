<script lang="ts">
import * as Field from "#lib/components/ui/field/index.js";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import type { BusCampusSummary } from "@/features/bus/lib/bus-timetable-types";

export let campuses: BusCampusSummary[];
export let disabled: boolean;
export let label: string;
export let onSelect: (campusId: number) => void;
export let selectedCampusId: number | null;
export let testId: string;
export let idPrefix: string;

function selectCampus(value: string) {
  if (!value) return;

  const campusId = Number.parseInt(value, 10);
  if (campuses.some((campus) => campus.id === campusId)) {
    onSelect(campusId);
  }
}
</script>

<Field.Field data-disabled={disabled ? "true" : undefined} data-testid={testId}>
  <Field.Title id={`${idPrefix}-label`}>{label}</Field.Title>
  <ToggleGroup.Root
    aria-labelledby={`${idPrefix}-label`}
    class="grid w-full grid-cols-3"
    spacing={2}
    type="single"
    value={selectedCampusId === null ? "" : String(selectedCampusId)}
    variant="outline"
    onValueChange={selectCampus}
  >
    {#each campuses as campus}
      <ToggleGroup.Item
        class="h-11 w-full justify-center md:h-8"
        {disabled}
        value={String(campus.id)}
      >
        {campus.namePrimary}
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</Field.Field>
