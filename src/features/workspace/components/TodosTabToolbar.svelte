<script lang="ts">
import type {
  TodoFilter,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import WorkspaceTaskToolbar from "./WorkspaceTaskToolbar.svelte";

export let createTodoError: string;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;
export let onTodoFilterChange: (value: TodoFilter) => void;
export let todosCopy: WorkspaceTodosCopy;
export let readOnlyReason: string | undefined = undefined;
</script>

<WorkspaceTaskToolbar
  ariaLabel={String(todosCopy.title)}
  filter={todoFilter}
  onFilterChange={onTodoFilterChange}
  filterIncompleteLabel={String(todosCopy.filterIncomplete)}
  filterCompletedLabel={String(todosCopy.filterCompleted)}
  filterAllLabel={String(todosCopy.filterAll)}
  addButtonLabel={String(todosCopy.addButton)}
  addTestId="workspace-todos-add"
  addDisabledReason={readOnlyReason}
  onAdd={() => {
    createTodoError = "";
    showCreateTodo = true;
  }}
/>
