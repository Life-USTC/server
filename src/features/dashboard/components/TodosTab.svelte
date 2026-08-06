<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardTodoItem,
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
  TodoFilter,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { resolveDashboardTaskFilter } from "@/features/dashboard/lib/dashboard-task-filter";
import { createTodoTabDisplayActions } from "@/features/dashboard/lib/todos-tab-display";
import * as Alert from "$lib/components/ui/alert/index.js";
import TodosCardsView from "./TodosCardsView.svelte";
import TodosListView from "./TodosListView.svelte";
import TodosTabDialogs from "./TodosTabDialogs.svelte";
import TodosTabToolbar from "./TodosTabToolbar.svelte";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: DashboardTodoItem) => string;
type TodoCompletionToggle = (todo: DashboardTodoItem) => void | Promise<void>;

export let todosCopy: DashboardTodosCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let sectionCopy: DashboardSectionCopy;
export let commentsCopy: CommentsCopy;
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let locale: string;
export let referenceDate: Date | string;

export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let toggleTodoCompletion: TodoCompletionToggle;
export let deleteTodo: (todo: DashboardTodoItem) => void | Promise<void>;
export let createTodoAction: SubmitFunction;
export let updateTodoAction: SubmitFunction;

export let todoFilter: TodoFilter;
export let todoItems: DashboardTodoItem[];
export let showCreateTodo: boolean;
export let selectedTodo: DashboardTodoItem | null;
export let editingTodo: DashboardTodoItem | null;
export let filteredTodos: DashboardTodoItem[];
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
    dashboardCopy,
    locale,
    referenceDate,
    sectionCopy,
    todosCopy,
  }));
$: resolvedTodoFilter = resolveDashboardTaskFilter(
  todoFilter,
  todoItems.some((todo) => !todo.completed),
);
$: if (todoFilter !== resolvedTodoFilter) {
  todoFilter = resolvedTodoFilter;
}
</script>

<section class="grid gap-4">
  <TodosTabToolbar
    bind:createTodoError
    bind:showCreateTodo
    {todoFilter}
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
