<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoItem,
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import TodoCreateDialog from "./TodoCreateDialog.svelte";
import TodoDetailDialog from "./TodoDetailDialog.svelte";
import TodoEditDialog from "./TodoEditDialog.svelte";

export let TODO_CONTENT_MAX_LENGTH: number;
export let TODO_TITLE_MAX_LENGTH: number;
export let commentsCopy: CommentsCopy;
export let createTodoAction: SubmitFunction;
export let createTodoError: string;
export let datetimeLocalValue: (
  value: string | Date | null | undefined,
) => string;
export let deleteTodo: (todo: DashboardTodoItem) => void | Promise<void>;
export let editTodoError: string;
export let editingTodo: DashboardTodoItem | null;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let selectedTodo: DashboardTodoItem | null;
export let showCreateTodo: boolean;
export let todoActionLabel: (todo: DashboardTodoItem) => string;
export let todoPriorityClass: (priority: string) => string;
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let toggleTodoCompletion: (
  todo: DashboardTodoItem,
) => void | Promise<void>;
export let updateTodoAction: SubmitFunction;
</script>

<TodoCreateDialog
  {TODO_CONTENT_MAX_LENGTH}
  {TODO_TITLE_MAX_LENGTH}
  {commentsCopy}
  {createTodoAction}
  {createTodoError}
  {isCreatingTodo}
  onClose={() => {
    showCreateTodo = false;
    createTodoError = "";
  }}
  open={showCreateTodo}
  {todoPriorityOptions}
  {todosCopy}
/>

<TodoDetailDialog
  deleteTodo={(todo) => {
    void deleteTodo(todo);
  }}
  {fmtDate}
  onClose={() => {
    selectedTodo = null;
  }}
  {openTodoEditor}
  todo={selectedTodo}
  {todoActionLabel}
  {todoPriorityClass}
  {todoSavingById}
  {todosCopy}
  {todoStatus}
  toggleTodoCompletion={(todo) => {
    void toggleTodoCompletion(todo);
  }}
/>

<TodoEditDialog
  {TODO_CONTENT_MAX_LENGTH}
  {TODO_TITLE_MAX_LENGTH}
  {commentsCopy}
  {datetimeLocalValue}
  {editTodoError}
  {isUpdatingTodo}
  onClose={() => {
    editingTodo = null;
    editTodoError = "";
  }}
  todo={editingTodo}
  {todoPriorityOptions}
  {todosCopy}
  {updateTodoAction}
/>
