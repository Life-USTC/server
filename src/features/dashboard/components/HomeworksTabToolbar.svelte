<script lang="ts">
import type {
  HomeworkFilter,
  HomeworkView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import LayoutGrid from "$lib/components/icons/layout-grid.svelte";
import List from "$lib/components/icons/list.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";

export let homeworksCopy: Record<string, string>;
export let homeworkFilter: HomeworkFilter;
export let homeworkView: HomeworkView;
export let openCreateHomeworkDialog: () => void;
export let setHomeworkView: (view: HomeworkView) => void;
</script>

<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="flex flex-wrap items-center gap-2 md:justify-start">
    <Tabs.List aria-label={homeworksCopy.viewMode}>
      <Tabs.Button
        selected={homeworkView === "cards"}
        onclick={() => {
          setHomeworkView("cards");
        }}
      >
        <LayoutGrid />
        {homeworksCopy.cardView}
      </Tabs.Button>
      <Tabs.Button
        selected={homeworkView === "list"}
        onclick={() => {
          setHomeworkView("list");
        }}
      >
        <List />
        {homeworksCopy.listView}
      </Tabs.Button>
    </Tabs.List>
    <Tabs.List aria-label={homeworksCopy.title}>
      <Tabs.Button
        selected={homeworkFilter === "incomplete"}
        onclick={() => {
          homeworkFilter = "incomplete";
        }}
      >
        {homeworksCopy.filterIncomplete}
      </Tabs.Button>
      <Tabs.Button
        selected={homeworkFilter === "completed"}
        onclick={() => {
          homeworkFilter = "completed";
        }}
      >
        {homeworksCopy.filterCompleted}
      </Tabs.Button>
      <Tabs.Button
        selected={homeworkFilter === "all"}
        onclick={() => {
          homeworkFilter = "all";
        }}
      >
        {homeworksCopy.filterAll}
      </Tabs.Button>
    </Tabs.List>
  </div>
  <div class="flex flex-wrap items-center gap-2 md:justify-end">
    <Button
      class="h-9 min-w-28"
      data-testid="dashboard-homeworks-add"
      type="button"
      onclick={openCreateHomeworkDialog}
    >
      {homeworksCopy.addButton}
    </Button>
  </div>
</div>
