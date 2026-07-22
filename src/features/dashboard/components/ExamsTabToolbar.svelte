<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import type {
  DashboardDashboardCopy,
  ExamView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { DashboardExamFilter } from "./dashboard-exam-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let examFilter: DashboardExamFilter;
export let examView: ExamView;
export let setExamView: (view: ExamView) => void;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:flex md:flex-wrap md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2">
    <ToggleGroup.Root
      aria-label={dashboardCopy.nav.exams.viewMode}
      class="hidden md:flex"
      type="single"
      value={examView}
      variant="outline"
      onValueChange={(value) => {
        if (value === "cards" || value === "list") setExamView(value);
      }}
    >
      <ToggleGroup.Item value="cards">
        <LayoutGrid data-icon="inline-start" />
        {dashboardCopy.nav.exams.cardView}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="list">
        <List data-icon="inline-start" />
        {dashboardCopy.nav.exams.listView}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
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
          examFilter = value;
        }
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
