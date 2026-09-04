<script lang="ts">
import type { SignedWorkspaceData } from "@/features/workspace/lib/workspace-controller-types";
import SignedWorkspaceExamsTaskBranch from "./SignedWorkspaceExamsTaskBranch.svelte";
import SignedWorkspaceHomeworksTaskBranch from "./SignedWorkspaceHomeworksTaskBranch.svelte";
import SignedWorkspaceTodosTaskBranch from "./SignedWorkspaceTodosTaskBranch.svelte";
import type { WorkspaceTaskTabsProps } from "./workspace-task-component-types";

type SignedWorkspaceExamData = SignedWorkspaceData & {
  subscriptions: NonNullable<SignedWorkspaceData["subscriptions"]>;
};

export let activeTab: WorkspaceTaskTabsProps["activeTab"];
export let applyHomeworkDueAtSemesterEnd: WorkspaceTaskTabsProps["applyHomeworkDueAtSemesterEnd"];
export let applyHomeworkDueInMonth: WorkspaceTaskTabsProps["applyHomeworkDueInMonth"];
export let applyHomeworkDueInWeek: WorkspaceTaskTabsProps["applyHomeworkDueInWeek"];
export let applyHomeworkStartNow: WorkspaceTaskTabsProps["applyHomeworkStartNow"];
export let commentsCopy: WorkspaceTaskTabsProps["commentsCopy"];
export let commonCopy: WorkspaceTaskTabsProps["commonCopy"];
export let createHomeworkAction: WorkspaceTaskTabsProps["createHomeworkAction"];
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: WorkspaceTaskTabsProps["createHomeworkPublishedAt"];
export let createHomeworkSectionId: WorkspaceTaskTabsProps["createHomeworkSectionId"];
export let createHomeworkSubmissionDueAt: WorkspaceTaskTabsProps["createHomeworkSubmissionDueAt"];
export let createHomeworkSubmissionStartAt: WorkspaceTaskTabsProps["createHomeworkSubmissionStartAt"];
export let createTodoAction: WorkspaceTaskTabsProps["createTodoAction"];
export let createTodoError: string;
export let workspaceCopy: WorkspaceTaskTabsProps["workspaceCopy"];
export let workspaceTabHref: WorkspaceTaskTabsProps["workspaceTabHref"];
export let data: WorkspaceTaskTabsProps["data"];
export let deleteTodo: WorkspaceTaskTabsProps["deleteTodo"];
export let editTodoError: string;
export let editingTodo: WorkspaceTaskTabsProps["editingTodo"];
export let examFilter: WorkspaceTaskTabsProps["examFilter"];
export let examMetadataLabels: WorkspaceTaskTabsProps["examMetadataLabels"];
export let examRows: WorkspaceTaskTabsProps["examRows"];
export let examTimeLabel: WorkspaceTaskTabsProps["examTimeLabel"];
export let filteredExamRows: WorkspaceTaskTabsProps["filteredExamRows"];
export let filteredTodos: WorkspaceTaskTabsProps["filteredTodos"];
export let homeworkActionError: string;
export let homeworkCopy: WorkspaceTaskTabsProps["homeworkCopy"];
export let homeworkFilter: WorkspaceTaskTabsProps["homeworkFilter"];
export let homeworkItems: WorkspaceTaskTabsProps["homeworkItems"];
export let homeworkReferenceDate: WorkspaceTaskTabsProps["homeworkReferenceDate"];
export let homeworkSavingById: WorkspaceTaskTabsProps["homeworkSavingById"];
export let homeworksCopy: WorkspaceTaskTabsProps["homeworksCopy"];
export let isCreatingHomework: boolean;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
export let namePrimary: WorkspaceTaskTabsProps["namePrimary"];
export let openCreateHomeworkDialog: WorkspaceTaskTabsProps["openCreateHomeworkDialog"];
export let openTodoEditor: WorkspaceTaskTabsProps["openTodoEditor"];
export let sectionCopy: WorkspaceTaskTabsProps["sectionCopy"];
export let selectedCreateHomeworkSection: WorkspaceTaskTabsProps["selectedCreateHomeworkSection"];
export let selectedHomework: WorkspaceTaskTabsProps["selectedHomework"];
export let selectedTodo: WorkspaceTaskTabsProps["selectedTodo"];
export let showCreateHomework: boolean;
export let showCreateTodo: boolean;
export let signedData: WorkspaceTaskTabsProps["signedData"];
export let subscriptionsCopy: WorkspaceTaskTabsProps["subscriptionsCopy"];
export let todoActionError: string;
export let todoFilter: WorkspaceTaskTabsProps["todoFilter"];
export let todoItems: WorkspaceTaskTabsProps["todoItems"];
export let todoPriorityOptions: WorkspaceTaskTabsProps["todoPriorityOptions"];
export let todoSavingById: WorkspaceTaskTabsProps["todoSavingById"];
export let todosCopy: WorkspaceTaskTabsProps["todosCopy"];
export let toggleHomeworkCompletion: WorkspaceTaskTabsProps["toggleHomeworkCompletion"];
export let toggleTodoCompletion: WorkspaceTaskTabsProps["toggleTodoCompletion"];
export let updateTodoAction: WorkspaceTaskTabsProps["updateTodoAction"];
</script>

{#if activeTab === "todos"}
  <SignedWorkspaceTodosTaskBranch
    {todosCopy}
    {workspaceCopy}
    {sectionCopy}
    {commentsCopy}
    {data}
    {todoPriorityOptions}
    homeworkReferenceDate={homeworkReferenceDate}
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
{:else if activeTab === "homeworks" && signedData.homeworks}
  <SignedWorkspaceHomeworksTaskBranch
    {commonCopy}
    {workspaceCopy}
    {sectionCopy}
    {homeworksCopy}
    {homeworkCopy}
    {homeworkActionError}
    {commentsCopy}
    {data}
    {signedData}
    homeworkReferenceDate={homeworkReferenceDate}
    {selectedCreateHomeworkSection}
    {openCreateHomeworkDialog}
    {applyHomeworkStartNow}
    {applyHomeworkDueInWeek}
    {applyHomeworkDueInMonth}
    {applyHomeworkDueAtSemesterEnd}
    {toggleHomeworkCompletion}
    {createHomeworkAction}
    bind:homeworkFilter
    bind:showCreateHomework
    bind:createHomeworkAdvancedOpen
    bind:createHomeworkPublishedAt
    bind:createHomeworkSectionId
    bind:createHomeworkSubmissionDueAt
    bind:createHomeworkSubmissionStartAt
    bind:selectedHomework
    bind:homeworkItems
    bind:homeworkSavingById
    bind:createHomeworkError
    bind:isCreatingHomework
  />
{:else if activeTab === "exams" && signedData.subscriptions}
  {@const examSignedData = signedData as SignedWorkspaceExamData}
  <SignedWorkspaceExamsTaskBranch
    {workspaceCopy}
    {subscriptionsCopy}
    {sectionCopy}
    signedData={examSignedData}
    {workspaceTabHref}
    {examTimeLabel}
    {examMetadataLabels}
    {namePrimary}
    {examRows}
    {filteredExamRows}
    locale={data.locale}
    bind:examFilter
  />
{/if}
