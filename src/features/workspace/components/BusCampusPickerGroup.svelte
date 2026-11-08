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
export let wrapLabels = false;

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
    class={wrapLabels ? "grid w-full grid-cols-2 md:grid-cols-3" : "grid w-full grid-cols-3"}
    spacing={2}
    type="single"
    value={selectedCampusId === null ? "" : String(selectedCampusId)}
    variant="outline"
    onValueChange={selectCampus}
  >
    {#each campuses as campus}
      <ToggleGroup.Item
        class={wrapLabels ? "h-auto min-h-11 w-full justify-center py-2 md:h-auto md:min-h-11 md:px-1 md:py-1.5" : "h-11 w-full justify-center md:h-8"}
        {disabled}
        value={String(campus.id)}
      >
        {#if wrapLabels}<span class="min-w-0 whitespace-normal">{campus.namePrimary}</span>{:else}{campus.namePrimary}{/if}
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</Field.Field>
