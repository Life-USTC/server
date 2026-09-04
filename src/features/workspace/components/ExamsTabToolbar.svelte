<script lang="ts">
import type { DashboardDashboardCopy } from "@/features/workspace/lib/dashboard-controller-types";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { DashboardExamFilter } from "./dashboard-exam-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let examFilter: DashboardExamFilter;
export let onExamFilterChange: (value: DashboardExamFilter) => void;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:flex md:flex-wrap md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2">
    <ToggleGroup.Root
      aria-label={dashboardCopy.nav.exams.title}
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
        {dashboardCopy.nav.exams.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="completed">
        {dashboardCopy.nav.exams.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="all">
        {dashboardCopy.nav.exams.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
</div>
