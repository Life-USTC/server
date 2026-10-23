<script lang="ts">
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { SubmitFunction } from "$app/forms";
import TodoCreateDialog from "./TodoCreateDialog.svelte";
import TodoDetailDialog from "./TodoDetailDialog.svelte";
import TodoEditDialog from "./TodoEditDialog.svelte";

export let commentsCopy: CommentsCopy;
export let createTodoAction: SubmitFunction;
export let createTodoError: string;
export let datetimeLocalValue: (
  value: string | Date | null | undefined,
) => string;
export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let editTodoError: string;
export let editingTodo: WorkspaceTodoItem | null;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let isCreatingTodo: boolean;
export let isDueOverdue: (value: string | Date | null | undefined) => boolean;
export let isUpdatingTodo: boolean;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let relativeDueLabel: (
  value: string | Date | null | undefined,
) => string;
export let selectedTodo: WorkspaceTodoItem | null;
export let showCreateTodo: boolean;
export let todoActionLabel: (todo: WorkspaceTodoItem) => string;
export let todoPriorityOptions: WorkspaceTodoPriorityOption[];
export let todoSavingById: Record<string, boolean>;
export let todosCopy: WorkspaceTodosCopy;
export let todoStatus: (todo: WorkspaceTodoItem) => string;
export let toggleTodoCompletion: (
  todo: WorkspaceTodoItem,
) => void | Promise<void>;
export let updateTodoAction: SubmitFunction;
export let readOnlyReason: string | undefined = undefined;
</script>

{#if !readOnlyReason}
<TodoCreateDialog
  commentsCopy={commentsCopy}
  createTodoAction={createTodoAction}
  createTodoError={createTodoError}
  isCreatingTodo={isCreatingTodo}
  onClose={() => {
    showCreateTodo = false;
    createTodoError = "";
  }}
  open={showCreateTodo}
  todoPriorityOptions={todoPriorityOptions}
  todosCopy={todosCopy}
/>
{/if}

<TodoDetailDialog
  {readOnlyReason}
  deleteTodo={(todo) => deleteTodo(todo)}
  fmtDate={fmtDate}
  isDueOverdue={isDueOverdue}
  onClose={() => {
    selectedTodo = null;
  }}
  openTodoEditor={openTodoEditor}
  relativeDueLabel={relativeDueLabel}
  todo={selectedTodo}
  todoActionLabel={todoActionLabel}
  todoSavingById={todoSavingById}
  todosCopy={todosCopy}
  todoStatus={todoStatus}
  toggleTodoCompletion={(todo) => {
    void toggleTodoCompletion(todo);
  }}
/>

{#if !readOnlyReason}
<TodoEditDialog
  commentsCopy={commentsCopy}
  datetimeLocalValue={datetimeLocalValue}
  editTodoError={editTodoError}
  isUpdatingTodo={isUpdatingTodo}
  onClose={() => {
    editingTodo = null;
    editTodoError = "";
  }}
  todo={editingTodo}
  todoPriorityOptions={todoPriorityOptions}
  todosCopy={todosCopy}
  updateTodoAction={updateTodoAction}
/>
{/if}
