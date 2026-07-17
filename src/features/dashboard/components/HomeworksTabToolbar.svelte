<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import Plus from "@lucide/svelte/icons/plus";
import type {
  HomeworkFilter,
  HomeworkView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import DashboardTaskViewMenu from "./DashboardTaskViewMenu.svelte";

export let homeworksCopy: Record<string, string>;
export let homeworkFilter: HomeworkFilter;
export let homeworkView: HomeworkView;
export let openCreateHomeworkDialog: () => void;
export let setHomeworkView: (view: HomeworkView) => void;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={homeworksCopy.viewMode}
      class="hidden md:flex"
      type="single"
      value={homeworkView}
      variant="outline"
      onValueChange={(value) => {
        if (value === "cards" || value === "list") {
          setHomeworkView(value);
        }
      }}
    >
      <ToggleGroup.Item value="cards">
        <LayoutGrid data-icon="inline-start" />
        {homeworksCopy.cardView}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="list">
        <List data-icon="inline-start" />
        {homeworksCopy.listView}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
    <ToggleGroup.Root
      aria-label={homeworksCopy.title}
      class="w-full min-w-0 md:w-fit"
      type="single"
      value={homeworkFilter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          homeworkFilter = value;
        }
      }}
    >
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="incomplete">
        {homeworksCopy.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="completed">
        {homeworksCopy.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="all">
        {homeworksCopy.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  <div class="flex items-center gap-2 md:justify-end">
    <DashboardTaskViewMenu
      cardLabel={homeworksCopy.cardView}
      label={homeworksCopy.viewMode}
      listLabel={homeworksCopy.listView}
      setView={setHomeworkView}
      testId="dashboard-homeworks-view-menu"
      view={homeworkView}
    />
    <Button
      aria-label={homeworksCopy.addButton}
      class="size-11 md:h-9 md:w-auto md:min-w-28"
      data-testid="dashboard-homeworks-add"
      type="button"
      onclick={openCreateHomeworkDialog}
    >
      <Plus class="md:hidden" />
      <span class="hidden md:inline">{homeworksCopy.addButton}</span>
    </Button>
  </div>
</div>
