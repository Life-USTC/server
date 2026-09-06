<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import { createTodoTabDisplayActions } from "@/features/workspace/lib/todos-tab-display";
import type {
  TodoFilter,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { resolveWorkspaceTaskFilter } from "@/features/workspace/lib/workspace-task-filter";
import * as Alert from "$lib/components/ui/alert/index.js";
import TodosCardsView from "./TodosCardsView.svelte";
import TodosListView from "./TodosListView.svelte";
import TodosTabDialogs from "./TodosTabDialogs.svelte";
import TodosTabToolbar from "./TodosTabToolbar.svelte";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: WorkspaceTodoItem) => string;
type TodoCompletionToggle = (todo: WorkspaceTodoItem) => void | Promise<void>;

export let todosCopy: WorkspaceTodosCopy;
export let workspaceCopy: WorkspaceCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let commentsCopy: CommentsCopy;
export let todoPriorityOptions: WorkspaceTodoPriorityOption[];
export let locale: string;
export let referenceDate: Date | string;

export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let toggleTodoCompletion: TodoCompletionToggle;
export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let createTodoAction: SubmitFunction;
export let updateTodoAction: SubmitFunction;

export let todoFilter: TodoFilter;
export let todoItems: WorkspaceTodoItem[];
export let showCreateTodo: boolean;
export let selectedTodo: WorkspaceTodoItem | null;
export let editingTodo: WorkspaceTodoItem | null;
export let filteredTodos: WorkspaceTodoItem[];
export let createTodoError: string;
export let editTodoError: string;
export let todoActionError: string;
export let todoSavingById: Record<string, boolean>;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
let datetimeLocalValue: TodoDateFormatter;
let fmtDate: TodoDateFormatter;
let todoActionLabel: TodoAction;
let todoStatus: TodoAction;

$: ({ datetimeLocalValue, fmtDate, todoActionLabel, todoStatus } =
  createTodoTabDisplayActions({
    workspaceCopy,
    locale,
    referenceDate,
    sectionCopy,
    todosCopy,
  }));
$: displayTodoFilter = resolveWorkspaceTaskFilter(
  todoFilter,
  todoItems.some((todo) => !todo.completed),
);
</script>

<section class="grid gap-4">
  <TodosTabToolbar
    bind:createTodoError
    bind:showCreateTodo
    todoFilter={displayTodoFilter}
    onTodoFilterChange={(value) => {
      todoFilter = value;
    }}
    {todosCopy}
  />

  {#if todoActionError}
    <Alert.Root variant="destructive">
      <Alert.Description>{todoActionError}</Alert.Description>
    </Alert.Root>
  {/if}

  <div class="md:hidden">
    <TodosCardsView
      {filteredTodos}
      {fmtDate}
      {openTodoEditor}
      bind:selectedTodo
      {todoActionLabel}
      {todoSavingById}
      {todosCopy}
      {todoStatus}
      {toggleTodoCompletion}
    />
  </div>
  <div class="hidden min-w-0 overflow-x-auto md:block">
    <TodosListView
      {filteredTodos}
      {fmtDate}
      {openTodoEditor}
      bind:selectedTodo
      {todoActionLabel}
      {todoSavingById}
      {todosCopy}
      {toggleTodoCompletion}
    />
  </div>

  <TodosTabDialogs
    {commentsCopy}
    {createTodoAction}
    bind:createTodoError
    {datetimeLocalValue}
    {deleteTodo}
    bind:editTodoError
    bind:editingTodo
    {fmtDate}
    {isCreatingTodo}
    {isUpdatingTodo}
    {openTodoEditor}
    bind:selectedTodo
    bind:showCreateTodo
    {todoActionLabel}
    {todoPriorityOptions}
    {todoSavingById}
    {todosCopy}
    {todoStatus}
    {toggleTodoCompletion}
    {updateTodoAction}
  />
</section>
