<script lang="ts">
import type {
  DashboardDashboardCopy,
  ExamView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import LayoutGrid from "$lib/components/icons/layout-grid.svelte";
import List from "$lib/components/icons/list.svelte";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { DashboardExamFilter } from "./dashboard-exam-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let examFilter: DashboardExamFilter;
export let examView: ExamView;
export let setExamView: (view: ExamView) => void;
</script>

<div class="flex flex-wrap items-center gap-2">
  <ToggleGroup.Root
    aria-label={dashboardCopy.nav.exams.viewMode}
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
    <ToggleGroup.Item value="incomplete">
      {dashboardCopy.nav.exams.filterIncomplete}
    </ToggleGroup.Item>
    <ToggleGroup.Item value="completed">
      {dashboardCopy.nav.exams.filterCompleted}
    </ToggleGroup.Item>
    <ToggleGroup.Item value="all">
      {dashboardCopy.nav.exams.filterAll}
    </ToggleGroup.Item>
  </ToggleGroup.Root>
</div>
