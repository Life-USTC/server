<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import type {
  HomeworkFilter,
  HomeworkView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let homeworksCopy: Record<string, string>;
export let homeworkFilter: HomeworkFilter;
export let homeworkView: HomeworkView;
export let openCreateHomeworkDialog: () => void;
export let setHomeworkView: (view: HomeworkView) => void;
</script>

<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="flex flex-wrap items-center gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={homeworksCopy.viewMode}
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
      <ToggleGroup.Item value="incomplete">
        {homeworksCopy.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="completed">
        {homeworksCopy.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="all">
        {homeworksCopy.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
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
