<script lang="ts">
import type { HomeworkFilter } from "@/features/workspace/lib/workspace-controller-types";
import WorkspaceTaskToolbar from "./WorkspaceTaskToolbar.svelte";

export let homeworksCopy: Record<string, string>;
export let homeworkFilter: HomeworkFilter;
export let onHomeworkFilterChange: (value: HomeworkFilter) => void;
export let openCreateHomeworkDialog: () => void;
</script>

<WorkspaceTaskToolbar
  ariaLabel={homeworksCopy.title}
  filter={homeworkFilter}
  onFilterChange={onHomeworkFilterChange}
  filterIncompleteLabel={homeworksCopy.filterIncomplete}
  filterCompletedLabel={homeworksCopy.filterCompleted}
  filterAllLabel={homeworksCopy.filterAll}
  addButtonLabel={homeworksCopy.addButton}
  addTestId="workspace-homeworks-add"
  onAdd={openCreateHomeworkDialog}
/>
