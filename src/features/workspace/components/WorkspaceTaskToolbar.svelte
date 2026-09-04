<script lang="ts" context="module">
export type WorkspaceTaskCompletionFilter = "incomplete" | "completed" | "all";
</script>

<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let ariaLabel: string;
export let filter: WorkspaceTaskCompletionFilter;
export let onFilterChange: (value: WorkspaceTaskCompletionFilter) => void;
export let filterIncompleteLabel: string;
export let filterCompletedLabel: string;
export let filterAllLabel: string;
export let addButtonLabel: string | undefined = undefined;
export let addTestId: string | undefined = undefined;
export let onAdd: (() => void) | undefined = undefined;
</script>

<div
  class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
>
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={ariaLabel}
      class="w-full min-w-0 md:w-fit"
      type="single"
      value={filter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          onFilterChange(value);
          return;
        }
        onFilterChange(filter);
      }}
    >
      <ToggleGroup.Item
        class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm"
        value="incomplete"
      >
        {filterIncompleteLabel}
      </ToggleGroup.Item>
      <ToggleGroup.Item
        class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm"
        value="completed"
      >
        {filterCompletedLabel}
      </ToggleGroup.Item>
      <ToggleGroup.Item
        class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm"
        value="all"
      >
        {filterAllLabel}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  {#if onAdd && addButtonLabel}
    <div class="flex items-center gap-2 md:justify-end">
      <Button
        aria-label={addButtonLabel}
        class="size-11 md:h-8 md:w-auto md:min-w-28"
        data-testid={addTestId}
        type="button"
        onclick={onAdd}
      >
        <Plus class="md:hidden" data-icon="inline-start" />
        <span class="hidden md:inline">{addButtonLabel}</span>
      </Button>
    </div>
  {/if}
</div>
