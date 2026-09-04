<script lang="ts">
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { WorkspaceExamFilter } from "./workspace-exam-component-types";

export let workspaceCopy: WorkspaceCopy;
export let examFilter: WorkspaceExamFilter;
export let onExamFilterChange: (value: WorkspaceExamFilter) => void;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:flex md:flex-wrap md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2">
    <ToggleGroup.Root
      aria-label={workspaceCopy.nav.exams.title}
      class="w-full min-w-0 md:w-fit"
      type="single"
      value={examFilter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          onExamFilterChange(value);
          return;
        }
        // Re-commit the controlled value when bits-ui clears a selected item.
        onExamFilterChange(examFilter);
      }}
    >
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="incomplete">
        {workspaceCopy.nav.exams.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="completed">
        {workspaceCopy.nav.exams.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="all">
        {workspaceCopy.nav.exams.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
</div>
