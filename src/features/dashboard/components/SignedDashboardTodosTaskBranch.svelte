<script lang="ts">
import type { DashboardTodosTaskProps } from "./dashboard-task-component-types";
import TodosTab from "./TodosTab.svelte";

export let commentsCopy: DashboardTodosTaskProps["commentsCopy"];
export let createTodoAction: DashboardTodosTaskProps["createTodoAction"];
export let createTodoError: string;
export let dashboardCopy: DashboardTodosTaskProps["dashboardCopy"];
export let data: DashboardTodosTaskProps["data"];
export let deleteTodo: DashboardTodosTaskProps["deleteTodo"];
export let editTodoError: string;
export let editingTodo: DashboardTodosTaskProps["editingTodo"];
export let filteredTodos: DashboardTodosTaskProps["filteredTodos"];
export let homeworkReferenceDate: DashboardTodosTaskProps["homeworkReferenceDate"];
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
export let openTodoEditor: DashboardTodosTaskProps["openTodoEditor"];
export let sectionCopy: DashboardTodosTaskProps["sectionCopy"];
export let selectedTodo: DashboardTodosTaskProps["selectedTodo"];
export let setTodoView: DashboardTodosTaskProps["setTodoView"];
export let showCreateTodo: boolean;
export let todoActionError: string;
export let todoContentMaxLength: number;
export let todoFilter: DashboardTodosTaskProps["todoFilter"];
export let todoPriorityClass: DashboardTodosTaskProps["todoPriorityClass"];
export let todoPriorityOptions: DashboardTodosTaskProps["todoPriorityOptions"];
export let todoSavingById: DashboardTodosTaskProps["todoSavingById"];
export let todoTitleMaxLength: number;
export let todoView: DashboardTodosTaskProps["todoView"];
export let todosCopy: DashboardTodosTaskProps["todosCopy"];
export let toggleTodoCompletion: DashboardTodosTaskProps["toggleTodoCompletion"];
export let updateTodoAction: DashboardTodosTaskProps["updateTodoAction"];
</script>

<TodosTab
  {todosCopy}
  {dashboardCopy}
  {sectionCopy}
  {commentsCopy}
  {todoPriorityOptions}
  TODO_TITLE_MAX_LENGTH={todoTitleMaxLength}
  TODO_CONTENT_MAX_LENGTH={todoContentMaxLength}
  locale={data.locale}
  referenceDate={homeworkReferenceDate}
  {openTodoEditor}
  {todoPriorityClass}
  {toggleTodoCompletion}
  {deleteTodo}
  {setTodoView}
  {createTodoAction}
  {updateTodoAction}
  {todoView}
  {filteredTodos}
  {todoActionError}
  {todoSavingById}
  {isCreatingTodo}
  {isUpdatingTodo}
  bind:todoFilter
  bind:showCreateTodo
  bind:selectedTodo
  bind:editingTodo
  bind:createTodoError
  bind:editTodoError
/>
