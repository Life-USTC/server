<script lang="ts">
import { tick } from "svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import { createTodoTabDisplayActions } from "@/features/workspace/lib/todos-tab-display";
import type {
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import type { SubmitFunction } from "$app/forms";
import type { WorkspaceCommonCopy } from "../lib/workspace-controller-types";
import {
  filterTodoTable,
  todoTableFields,
} from "../lib/workspace-task-table-filters";
import TodoDetailDialog from "./TodoDetailDialog.svelte";
import TodoFormDialog from "./TodoFormDialog.svelte";
import TodosCollection from "./TodosCollection.svelte";
import WorkspaceTaskAddButton from "./WorkspaceTaskAddButton.svelte";
import WorkspaceTaskFilterToolbar from "./WorkspaceTaskFilterToolbar.svelte";

type TodoCompletionToggle = (todo: WorkspaceTodoItem) => void | Promise<void>;

export let commonCopy: WorkspaceCommonCopy;
export let todosCopy: WorkspaceTodosCopy;
export let workspaceCopy: WorkspaceCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let commentsCopy: CommentsCopy;
export let todoPriorityOptions: WorkspaceTodoPriorityOption[];
export let locale: string;
export let referenceDate: Date | string;
export let readOnlyReason: string | undefined = undefined;

export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let toggleTodoCompletion: TodoCompletionToggle;
export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let createTodoAction: SubmitFunction;
export let updateTodoAction: SubmitFunction;

export let showCreateTodo: boolean;
export let selectedTodo: WorkspaceTodoItem | null;
export let editingTodo: WorkspaceTodoItem | null;
export let hasTodoItems: boolean;
export let todoItems: WorkspaceTodoItem[];
let applied: Record<string, string> = { completion: "incomplete" };
let draft = { ...applied };
$: fields = todoTableFields({ todos: todosCopy });
$: filteredTodos = filterTodoTable(todoItems, fields, applied);
export let createTodoError: string;
export let editTodoError: string;
export let todoActionError: string;
export let todoSavingById: Record<string, boolean>;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
$: display = createTodoTabDisplayActions({
  workspaceCopy,
  locale,
  referenceDate,
  sectionCopy,
  todosCopy,
});
let detailTrigger: HTMLButtonElement | undefined;
function selectTodo(todo: WorkspaceTodoItem, trigger: HTMLButtonElement) {
  detailTrigger = trigger;
  selectedTodo = todo;
}
async function closeDetail() {
  selectedTodo = null;
  await tick();
  detailTrigger?.focus();
}
function clearTodoFilter() {
  draft = {};
  applied = {};
}
</script>

<section class="grid gap-4">
  <WorkspaceTaskAddButton
    {readOnlyReason}
    label={String(todosCopy.addButton)}
    testId="workspace-todos-add"
    onclick={() => {
      createTodoError = "";
      showCreateTodo = true;
    }}
  />

  {#if todoActionError}
    <Alert.Message variant="destructive">{todoActionError}</Alert.Message>
  {/if}

  <WorkspaceTaskFilterToolbar id="todo-table-filters" {fields} commonNames={["completion", "priority", "dueAt"]} bind:draft bind:applied copy={commonCopy} sortLabel={commonCopy.taskFilters.todoSort} onreset={clearTodoFilter} />
  <TodosCollection
    emptyTitle={commonCopy.taskFilters.emptyTodos}
    {readOnlyReason}
    {filteredTodos}
    {hasTodoItems}
    onClearFilter={clearTodoFilter}
    {display}
    {openTodoEditor}
    onSelect={selectTodo}
    {todoSavingById}
    {todosCopy}
    {toggleTodoCompletion}
  />

  {#if !readOnlyReason && showCreateTodo}
    <TodoFormDialog
      {commentsCopy}
      submit={createTodoAction}
      error={createTodoError}
      saving={isCreatingTodo}
      onClose={() => {
        showCreateTodo = false;
        createTodoError = "";
      }}
      {todoPriorityOptions}
      {todosCopy}
    />
  {/if}

  <TodoDetailDialog
    {readOnlyReason}
    {deleteTodo}
    {display}
    onClose={closeDetail}
    {openTodoEditor}
    todo={selectedTodo}
    {todoSavingById}
    {todosCopy}
    {toggleTodoCompletion}
  />

  {#if !readOnlyReason && editingTodo}
    <TodoFormDialog
      {commentsCopy}
      error={editTodoError}
      saving={isUpdatingTodo}
      onClose={() => {
        editingTodo = null;
        editTodoError = "";
      }}
      todo={editingTodo}
      {todoPriorityOptions}
      {todosCopy}
      submit={updateTodoAction}
    />
  {/if}
</section>
