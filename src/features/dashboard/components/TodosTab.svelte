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
  TodoView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { createTodoTabDisplayActions } from "@/features/dashboard/lib/todos-tab-display";
import { Alert } from "$lib/components/ui/alert/index.js";
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
export let TODO_TITLE_MAX_LENGTH: number;
export let TODO_CONTENT_MAX_LENGTH: number;
export let locale: string;
export let referenceDate: Date | string;

export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let todoPriorityClass: (
  priority: DashboardTodoItem["priority"],
) => string;
export let toggleTodoCompletion: TodoCompletionToggle;
export let deleteTodo: (todo: DashboardTodoItem) => void | Promise<void>;
export let setTodoView: (view: TodoView) => void;
export let createTodoAction: SubmitFunction;
export let updateTodoAction: SubmitFunction;

export let todoFilter: TodoFilter;
export let todoView: TodoView;
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
</script>

<section class="grid gap-4">
  <TodosTabToolbar
    bind:createTodoError
    {setTodoView}
    bind:showCreateTodo
    bind:todoFilter
    {todosCopy}
    {todoView}
  />

  {#if todoActionError}
    <Alert variant="destructive">{todoActionError}</Alert>
  {/if}

  {#if todoView === "cards"}
    <TodosCardsView
      {filteredTodos}
      {fmtDate}
      {openTodoEditor}
      bind:selectedTodo
      {todoActionLabel}
      {todoPriorityClass}
      {todoSavingById}
      {todosCopy}
      {todoStatus}
      {toggleTodoCompletion}
    />
  {:else}
    <TodosListView
      {filteredTodos}
      {fmtDate}
      {openTodoEditor}
      bind:selectedTodo
      {todoActionLabel}
      {todoPriorityClass}
      {todoSavingById}
      {todosCopy}
      {toggleTodoCompletion}
    />
  {/if}

  <TodosTabDialogs
    {TODO_CONTENT_MAX_LENGTH}
    {TODO_TITLE_MAX_LENGTH}
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
    {todoPriorityClass}
    {todoPriorityOptions}
    {todoSavingById}
    {todosCopy}
    {todoStatus}
    {toggleTodoCompletion}
    {updateTodoAction}
  />
</section>
