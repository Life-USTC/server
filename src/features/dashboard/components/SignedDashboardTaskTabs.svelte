<script lang="ts">
import type { SignedDashboardData } from "@/features/dashboard/lib/dashboard-controller-types";
import type { DashboardTaskTabsProps } from "./dashboard-task-component-types";
import SignedDashboardExamsTaskBranch from "./SignedDashboardExamsTaskBranch.svelte";
import SignedDashboardHomeworksTaskBranch from "./SignedDashboardHomeworksTaskBranch.svelte";
import SignedDashboardTodosTaskBranch from "./SignedDashboardTodosTaskBranch.svelte";

type SignedDashboardExamData = SignedDashboardData & {
  subscriptions: NonNullable<SignedDashboardData["subscriptions"]>;
};

export let activeTab: DashboardTaskTabsProps["activeTab"];
export let applyHomeworkDueAtSemesterEnd: DashboardTaskTabsProps["applyHomeworkDueAtSemesterEnd"];
export let applyHomeworkDueInMonth: DashboardTaskTabsProps["applyHomeworkDueInMonth"];
export let applyHomeworkDueInWeek: DashboardTaskTabsProps["applyHomeworkDueInWeek"];
export let applyHomeworkStartNow: DashboardTaskTabsProps["applyHomeworkStartNow"];
export let commentsCopy: DashboardTaskTabsProps["commentsCopy"];
export let commonCopy: DashboardTaskTabsProps["commonCopy"];
export let createHomeworkAction: DashboardTaskTabsProps["createHomeworkAction"];
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: DashboardTaskTabsProps["createHomeworkPublishedAt"];
export let createHomeworkSectionId: DashboardTaskTabsProps["createHomeworkSectionId"];
export let createHomeworkSubmissionDueAt: DashboardTaskTabsProps["createHomeworkSubmissionDueAt"];
export let createHomeworkSubmissionStartAt: DashboardTaskTabsProps["createHomeworkSubmissionStartAt"];
export let createTodoAction: DashboardTaskTabsProps["createTodoAction"];
export let createTodoError: string;
export let dashboardCopy: DashboardTaskTabsProps["dashboardCopy"];
export let dashboardTabHref: DashboardTaskTabsProps["dashboardTabHref"];
export let data: DashboardTaskTabsProps["data"];
export let deleteTodo: DashboardTaskTabsProps["deleteTodo"];
export let editTodoError: string;
export let editingTodo: DashboardTaskTabsProps["editingTodo"];
export let examFilter: DashboardTaskTabsProps["examFilter"];
export let examMetadataLabels: DashboardTaskTabsProps["examMetadataLabels"];
export let examRows: DashboardTaskTabsProps["examRows"];
export let examTimeLabel: DashboardTaskTabsProps["examTimeLabel"];
export let examView: DashboardTaskTabsProps["examView"];
export let filteredExamRows: DashboardTaskTabsProps["filteredExamRows"];
export let filteredTodos: DashboardTaskTabsProps["filteredTodos"];
export let homeworkCopy: DashboardTaskTabsProps["homeworkCopy"];
export let homeworkDescriptionMaxLength: number;
export let homeworkFilter: DashboardTaskTabsProps["homeworkFilter"];
export let homeworkItems: DashboardTaskTabsProps["homeworkItems"];
export let homeworkReferenceDate: DashboardTaskTabsProps["homeworkReferenceDate"];
export let homeworkSavingById: DashboardTaskTabsProps["homeworkSavingById"];
export let homeworkTitleMaxLength: number;
export let homeworkView: DashboardTaskTabsProps["homeworkView"];
export let homeworksCopy: DashboardTaskTabsProps["homeworksCopy"];
export let isCreatingHomework: boolean;
export let isCreatingTodo: boolean;
export let isUpdatingTodo: boolean;
export let namePrimary: DashboardTaskTabsProps["namePrimary"];
export let openCreateHomeworkDialog: DashboardTaskTabsProps["openCreateHomeworkDialog"];
export let openTodoEditor: DashboardTaskTabsProps["openTodoEditor"];
export let sectionCopy: DashboardTaskTabsProps["sectionCopy"];
export let selectedCreateHomeworkSection: DashboardTaskTabsProps["selectedCreateHomeworkSection"];
export let selectedHomework: DashboardTaskTabsProps["selectedHomework"];
export let selectedTodo: DashboardTaskTabsProps["selectedTodo"];
export let setExamView: DashboardTaskTabsProps["setExamView"];
export let setHomeworkView: DashboardTaskTabsProps["setHomeworkView"];
export let setTodoView: DashboardTaskTabsProps["setTodoView"];
export let showCreateHomework: boolean;
export let showCreateTodo: boolean;
export let signedData: DashboardTaskTabsProps["signedData"];
export let subscriptionsCopy: DashboardTaskTabsProps["subscriptionsCopy"];
export let todoActionError: string;
export let todoContentMaxLength: number;
export let todoFilter: DashboardTaskTabsProps["todoFilter"];
export let todoPriorityClass: DashboardTaskTabsProps["todoPriorityClass"];
export let todoPriorityOptions: DashboardTaskTabsProps["todoPriorityOptions"];
export let todoSavingById: DashboardTaskTabsProps["todoSavingById"];
export let todoTitleMaxLength: number;
export let todoView: DashboardTaskTabsProps["todoView"];
export let todosCopy: DashboardTaskTabsProps["todosCopy"];
export let toggleHomeworkCompletion: DashboardTaskTabsProps["toggleHomeworkCompletion"];
export let toggleTodoCompletion: DashboardTaskTabsProps["toggleTodoCompletion"];
export let updateTodoAction: DashboardTaskTabsProps["updateTodoAction"];
</script>

{#if activeTab === "todos"}
  <SignedDashboardTodosTaskBranch
    {todosCopy}
    {dashboardCopy}
    {sectionCopy}
    {commentsCopy}
    {data}
    {todoPriorityOptions}
    todoTitleMaxLength={todoTitleMaxLength}
    todoContentMaxLength={todoContentMaxLength}
    homeworkReferenceDate={homeworkReferenceDate}
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
{:else if activeTab === "homeworks" && signedData.homeworks}
  <SignedDashboardHomeworksTaskBranch
    {commonCopy}
    {dashboardCopy}
    {sectionCopy}
    {homeworksCopy}
    {homeworkCopy}
    {commentsCopy}
    {data}
    {signedData}
    homeworkTitleMaxLength={homeworkTitleMaxLength}
    homeworkDescriptionMaxLength={homeworkDescriptionMaxLength}
    homeworkReferenceDate={homeworkReferenceDate}
    {selectedCreateHomeworkSection}
    {openCreateHomeworkDialog}
    {applyHomeworkStartNow}
    {applyHomeworkDueInWeek}
    {applyHomeworkDueInMonth}
    {applyHomeworkDueAtSemesterEnd}
    {toggleHomeworkCompletion}
    {setHomeworkView}
    {createHomeworkAction}
    bind:homeworkFilter
    bind:homeworkView
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
  {@const examSignedData = signedData as SignedDashboardExamData}
  <SignedDashboardExamsTaskBranch
    {dashboardCopy}
    {subscriptionsCopy}
    {sectionCopy}
    signedData={examSignedData}
    {dashboardTabHref}
    {examTimeLabel}
    {examMetadataLabels}
    {namePrimary}
    {setExamView}
    {examView}
    {examRows}
    {filteredExamRows}
    bind:examFilter
  />
{/if}
