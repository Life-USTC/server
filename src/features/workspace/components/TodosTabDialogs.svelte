<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
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
export let isUpdatingTodo: boolean;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
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
</script>

<TodoCreateDialog
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
  deleteTodo={(todo) => deleteTodo(todo)}
  {fmtDate}
  onClose={() => {
    selectedTodo = null;
  }}
  {openTodoEditor}
  todo={selectedTodo}
  {todoActionLabel}
  {todoSavingById}
  {todosCopy}
  {todoStatus}
  toggleTodoCompletion={(todo) => {
    void toggleTodoCompletion(todo);
  }}
/>

<TodoEditDialog
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
