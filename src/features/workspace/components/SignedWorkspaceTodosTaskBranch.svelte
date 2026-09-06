<script lang="ts">
import TodosTab from "./TodosTab.svelte";
import type { WorkspaceTodosTaskProps } from "./workspace-task-component-types";

export let commentsCopy: WorkspaceTodosTaskProps["commentsCopy"];
export let createTodoAction: WorkspaceTodosTaskProps["createTodoAction"];
export let createTodoError: string;
export let workspaceCopy: WorkspaceTodosTaskProps["workspaceCopy"];
export let data: WorkspaceTodosTaskProps["data"];
export let deleteTodo: WorkspaceTodosTaskProps["deleteTodo"];
export let editTodoError: string;
export let editingTodo: WorkspaceTodosTaskProps["editingTodo"];
export let filteredTodos: WorkspaceTodosTaskProps["filteredTodos"];
export let homeworkReferenceDate: WorkspaceTodosTaskProps["homeworkReferenceDate"];
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
export let openTodoEditor: WorkspaceTodosTaskProps["openTodoEditor"];
export let sectionCopy: WorkspaceTodosTaskProps["sectionCopy"];
export let selectedTodo: WorkspaceTodosTaskProps["selectedTodo"];
export let showCreateTodo: boolean;
export let todoActionError: string;
export let todoFilter: WorkspaceTodosTaskProps["todoFilter"];
export let todoItems: WorkspaceTodosTaskProps["todoItems"];
export let todoPriorityOptions: WorkspaceTodosTaskProps["todoPriorityOptions"];
export let todoSavingById: WorkspaceTodosTaskProps["todoSavingById"];
export let todosCopy: WorkspaceTodosTaskProps["todosCopy"];
export let toggleTodoCompletion: WorkspaceTodosTaskProps["toggleTodoCompletion"];
export let updateTodoAction: WorkspaceTodosTaskProps["updateTodoAction"];
</script>

<TodosTab
  {todosCopy}
  {workspaceCopy}
  {sectionCopy}
  {commentsCopy}
  {todoPriorityOptions}
  locale={data.locale}
  referenceDate={homeworkReferenceDate}
  {openTodoEditor}
  {toggleTodoCompletion}
  {deleteTodo}
  {createTodoAction}
  {updateTodoAction}
  {filteredTodos}
  {todoActionError}
  {todoItems}
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
