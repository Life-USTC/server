<script lang="ts">
import type {
  DashboardDashboardCopy,
  ExamView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import LayoutGrid from "$lib/components/icons/layout-grid.svelte";
import List from "$lib/components/icons/list.svelte";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type { DashboardExamFilter } from "./dashboard-exam-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let examFilter: DashboardExamFilter;
export let examView: ExamView;
export let setExamView: (view: ExamView) => void;
</script>

<div class="flex flex-wrap items-center gap-2">
  <Tabs.List aria-label={dashboardCopy.nav.exams.viewMode}>
    <Tabs.Button selected={examView === "cards"} onclick={() => { setExamView("cards"); }}>
      <LayoutGrid />
      {dashboardCopy.nav.exams.cardView}
    </Tabs.Button>
    <Tabs.Button selected={examView === "list"} onclick={() => { setExamView("list"); }}>
      <List />
      {dashboardCopy.nav.exams.listView}
    </Tabs.Button>
  </Tabs.List>
  <Tabs.List aria-label={dashboardCopy.nav.exams.title}>
    <Tabs.Button selected={examFilter === "incomplete"} onclick={() => { examFilter = "incomplete"; }}>
      {dashboardCopy.nav.exams.filterIncomplete}
    </Tabs.Button>
    <Tabs.Button selected={examFilter === "completed"} onclick={() => { examFilter = "completed"; }}>
      {dashboardCopy.nav.exams.filterCompleted}
    </Tabs.Button>
    <Tabs.Button selected={examFilter === "all"} onclick={() => { examFilter = "all"; }}>
      {dashboardCopy.nav.exams.filterAll}
    </Tabs.Button>
  </Tabs.List>
</div>
