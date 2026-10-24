<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import WorkspaceCollection from "#lib/components/WorkspaceCollection.svelte";
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
import type { SubmitFunction } from "$app/forms";
import type { WorkspaceCommonCopy } from "../lib/workspace-controller-types";
import {
  filterTodoTable,
  todoTableFields,
} from "../lib/workspace-task-table-filters";
import TodosCardsView from "./TodosCardsView.svelte";
import TodosListView from "./TodosListView.svelte";
import TodosTabDialogs from "./TodosTabDialogs.svelte";
import TodosTabToolbar from "./TodosTabToolbar.svelte";
import WorkspaceTaskColumnFilter from "./WorkspaceTaskColumnFilter.svelte";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: WorkspaceTodoItem) => string;
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

export let todoFilter: TodoFilter;
export let showCreateTodo: boolean;
export let selectedTodo: WorkspaceTodoItem | null;
export let editingTodo: WorkspaceTodoItem | null;
export let hasTodoItems: boolean;
export let todoItems: WorkspaceTodoItem[];
let applied: Record<string, string> = { completion: "incomplete" };
let draft = { ...applied };
$: fields = todoTableFields({ todos: todosCopy });
$: filteredTodos = filterTodoTable(todoItems, fields, applied);
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
export let createTodoError: string;
export let editTodoError: string;
export let todoActionError: string;
export let todoSavingById: Record<string, boolean>;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
let datetimeLocalValue: TodoDateFormatter;
let fmtDate: TodoDateFormatter;
let isDueOverdue: (value: Date | string | null | undefined) => boolean;
let relativeDueLabel: TodoDateFormatter;
let todoActionLabel: TodoAction;
let todoStatus: TodoAction;

$: ({
  datetimeLocalValue,
  fmtDate,
  isDueOverdue,
  relativeDueLabel,
  todoActionLabel,
  todoStatus,
} = createTodoTabDisplayActions({
  workspaceCopy,
  locale,
  referenceDate,
  sectionCopy,
  todosCopy,
}));
function clearTodoFilter() {
  todoFilter = "all";
  draft = {};
  applied = {};
}
</script>

{#snippet columnFilter(names: string[], label: string, prefix: string)}
  <WorkspaceTaskColumnFilter fields={fields.filter((field) => names.includes(field.name))} values={draft} {applied} onchange={patchDraft} {label} prefix={`${prefix}-todo-${names[0]}`} labels={commonCopy.tableFilters} formId="todo-table-filters" />
{/snippet}

<section class="grid gap-4">
  <TodosTabToolbar
    {readOnlyReason}
    bind:createTodoError
    bind:showCreateTodo
    todosCopy={todosCopy}
  />

  {#if todoActionError}
    <Alert.Root variant="destructive">
      <Alert.Description>{todoActionError}</Alert.Description>
    </Alert.Root>
  {/if}

  <form id="todo-table-filters" onsubmit={applyFilters} class="flex flex-wrap items-center gap-3" data-slot="table-filter-apply">
    {@render columnFilter(["completion"], todosCopy.statusLabel, "extra")}
    {@render columnFilter(["content"], todosCopy.contentLabel, "extra")}
    <Button type="submit">{commonCopy.applyFilters}</Button>
  </form>
  <WorkspaceCollection>
    {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        {#each fields.filter((field) => ["title", "priority", "dueAt"].includes(field.name)) as field}
          {@render columnFilter([field.name], field.label, "mobile")}
        {/each}
      </div>
      <TodosCardsView
        {readOnlyReason}
        filteredTodos={filteredTodos}
        hasTodoItems={hasTodoItems}
        onClearFilter={clearTodoFilter}
        fmtDate={fmtDate}
        openTodoEditor={openTodoEditor}
        bind:selectedTodo
        todoActionLabel={todoActionLabel}
        todoSavingById={todoSavingById}
        todosCopy={todosCopy}
        todoStatus={todoStatus}
        toggleTodoCompletion={toggleTodoCompletion}
      />
    {/snippet}
    {#snippet desktop()}
      <TodosListView
        filterControls={columnFilter}
        {readOnlyReason}
        filteredTodos={filteredTodos}
        hasTodoItems={hasTodoItems}
        onClearFilter={clearTodoFilter}
        fmtDate={fmtDate}
        openTodoEditor={openTodoEditor}
        bind:selectedTodo
        todoActionLabel={todoActionLabel}
        todoSavingById={todoSavingById}
        todosCopy={todosCopy}
        toggleTodoCompletion={toggleTodoCompletion}
      />
    {/snippet}
  </WorkspaceCollection>

  <TodosTabDialogs
    {readOnlyReason}
    commentsCopy={commentsCopy}
    createTodoAction={createTodoAction}
    bind:createTodoError
    datetimeLocalValue={datetimeLocalValue}
    deleteTodo={deleteTodo}
    bind:editTodoError
    bind:editingTodo
    fmtDate={fmtDate}
    isCreatingTodo={isCreatingTodo}
    isUpdatingTodo={isUpdatingTodo}
    isDueOverdue={isDueOverdue}
    openTodoEditor={openTodoEditor}
    relativeDueLabel={relativeDueLabel}
    bind:selectedTodo
    bind:showCreateTodo
    todoActionLabel={todoActionLabel}
    todoPriorityOptions={todoPriorityOptions}
    todoSavingById={todoSavingById}
    todosCopy={todosCopy}
    todoStatus={todoStatus}
    toggleTodoCompletion={toggleTodoCompletion}
    updateTodoAction={updateTodoAction}
  />
</section>
