<script lang="ts">
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import WorkspaceTaskToolbar from "./WorkspaceTaskToolbar.svelte";
import type { WorkspaceExamFilter } from "./workspace-exam-component-types";

export let workspaceCopy: WorkspaceCopy;
export let examFilter: WorkspaceExamFilter;
export let onExamFilterChange: (value: WorkspaceExamFilter) => void;
</script>

<WorkspaceTaskToolbar
  ariaLabel={workspaceCopy.nav.exams.title}
  filter={examFilter}
  onFilterChange={onExamFilterChange}
  filterIncompleteLabel={workspaceCopy.nav.exams.filterIncomplete}
  filterCompletedLabel={workspaceCopy.nav.exams.filterCompleted}
  filterAllLabel={workspaceCopy.nav.exams.filterAll}
/>
