<script lang="ts">
import type { BusCampusSummary } from "@/features/bus/lib/bus-timetable-types";
import { Button } from "$lib/components/ui/button/index.js";

export let campuses: BusCampusSummary[];
export let disabled: boolean;
export let label: string;
export let onSelect: (campusId: number) => void;
export let selectedCampusId: number | null;
export let testId: string;
</script>

<div data-testid={testId}>
  <h3 class="mb-2 font-medium">{label}</h3>
  <div class="grid grid-cols-3 gap-2">
    {#each campuses as campus}
      <Button
        aria-pressed={selectedCampusId === campus.id}
        class={`justify-start ${selectedCampusId === campus.id ? "border-primary bg-base-200 text-base-content" : ""}`}
        {disabled}
        type="button"
        variant="outline"
        onclick={() => onSelect(campus.id)}
      >
        {campus.namePrimary}
      </Button>
    {/each}
  </div>
</div>
