<script lang="ts" context="module">
export type WorkspaceTaskCompletionFilter = "incomplete" | "completed" | "all";
</script>

<script lang="ts">
import { onMount } from "svelte";
import { toolbarFieldClass } from "#lib/components/toolbar-control.js";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import { cn } from "#lib/utils.js";

export let ariaLabel: string;
export let columnLabel: string;
export let filter: WorkspaceTaskCompletionFilter;
export let onFilterChange: (value: WorkspaceTaskCompletionFilter) => void;
export let filterIncompleteLabel: string;
export let filterCompletedLabel: string;
export let filterAllLabel: string;
let ready = false;
onMount(() => {
  ready = true;
});
</script>

<TableColumnHeader label={columnLabel} active={filter !== "all"} disabled={!ready}>
    <ToggleGroup.Root
      aria-label={ariaLabel}
      class="w-full min-w-0 md:w-fit"
      type="single"
      variant="outline"
      disabled={!ready}
      bind:value={
        () => filter,
        (value) => {
          if (
            value === "incomplete" ||
            value === "completed" ||
            value === "all"
          ) {
            onFilterChange(value);
          }
        }
      }
    >
      <ToggleGroup.Item
        class={cn(toolbarFieldClass, "min-w-0 flex-1 text-xs md:flex-none md:text-sm")}
        value="incomplete"
      >
        {filterIncompleteLabel}
      </ToggleGroup.Item>
      <ToggleGroup.Item
        class={cn(toolbarFieldClass, "min-w-0 flex-1 text-xs md:flex-none md:text-sm")}
        value="completed"
      >
        {filterCompletedLabel}
      </ToggleGroup.Item>
      <ToggleGroup.Item
        class={cn(toolbarFieldClass, "min-w-0 flex-1 text-xs md:flex-none md:text-sm")}
        value="all"
      >
        {filterAllLabel}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
</TableColumnHeader>
