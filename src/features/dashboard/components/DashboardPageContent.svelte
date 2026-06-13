<script lang="ts">
import type { ComponentProps } from "svelte";
import { onMount } from "svelte";
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import type {
  AnonymousDashboardData,
  AnonymousLinkGroup,
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardPageData,
  DashboardTodoItem,
  HomeworkFilter,
  HomeworkView,
  LinkView,
  SignedDashboardData,
  TodoFilter,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import AnonymousDashboardView from "./AnonymousDashboardView.svelte";
import DashboardStatusAlerts from "./DashboardStatusAlerts.svelte";
import type { DashboardExamFilter } from "./dashboard-exam-component-types";
import SignedDashboardContent from "./SignedDashboardContent.svelte";

type DashboardStatusAlertState = {
  actionError: string;
  calendarCopyError: string;
  calendarCopyMessage: string;
};

export let anonymousBranch: {
  data: AnonymousDashboardData | null;
  linkGroups: AnonymousLinkGroup[];
};
export let busCopy: DashboardBusCopy;
export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let data: DashboardPageData;
export let linkIconLabel: (value: unknown) => string;
export let linkView: LinkView;
export let setLinkView: (view: LinkView) => void;
export let signedData: SignedDashboardData | null;
export let statusAlerts: DashboardStatusAlertState;

export let bulkImportSemesterId: string;
export let bulkImportText: string;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let createTodoError: string;
export let editTodoError: string;
export let editingTodo: DashboardTodoItem | null;
export let examFilter: DashboardExamFilter;
export let homeworkFilter: HomeworkFilter;
export let homeworkItems: DashboardHomeworkItem[];
export let homeworkSavingById: Record<string, boolean>;
export let homeworkView: HomeworkView;
export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let isCreatingHomework: boolean;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let selectedHomework: DashboardHomeworkItem | null;
export let selectedTodo: DashboardTodoItem | null;
export let showCreateHomework: boolean;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;

$: signedDashboardContentProps = $$props as unknown as ComponentProps<
  typeof SignedDashboardContent
>;

let mounted = false;

onMount(() => {
  mounted = true;
});
</script>

<div class="mx-auto grid w-full max-w-6xl gap-6">
  <DashboardStatusAlerts
    actionError={statusAlerts.actionError}
    calendarCopyError={statusAlerts.calendarCopyError}
    calendarCopyMessage={statusAlerts.calendarCopyMessage}
  />

  {#if signedData}
    <SignedDashboardContent
      {...signedDashboardContentProps}
      bind:bulkImportSemesterId
      bind:bulkImportText
      bind:createHomeworkAdvancedOpen
      bind:createHomeworkError
      bind:createHomeworkPublishedAt
      bind:createHomeworkSectionId
      bind:createHomeworkSubmissionDueAt
      bind:createHomeworkSubmissionStartAt
      bind:createTodoError
      bind:editTodoError
      bind:editingTodo
      bind:examFilter
      bind:homeworkFilter
      bind:homeworkItems
      bind:homeworkSavingById
      bind:homeworkView
      bind:isBulkImportOpen
      bind:isConfirmImportOpen
      bind:isCreatingHomework
      bind:linkSearchInput
      bind:linkSearchQuery
      bind:selectedHomework
      bind:selectedTodo
      bind:showCreateHomework
      bind:showCreateTodo
      bind:todoFilter
    />
  {:else if data.signedIn && data.userMissing}
    <Alert variant="warning">{commonCopy.userNotFound}</Alert>
  {:else if anonymousBranch.data?.tab === "bus" && !mounted}
    <div class="rounded-xl border border-base-300 bg-base-100 p-4 text-base-content/70 text-sm">
      {busCopy.empty}
    </div>
  {:else if anonymousBranch.data}
    <AnonymousDashboardView
      anonymousData={anonymousBranch.data}
      anonymousLinkGroups={anonymousBranch.linkGroups}
      {busCopy}
      {dashboardCopy}
      {linkIconLabel}
      {linkView}
      {setLinkView}
      bind:linkSearchInput
      bind:linkSearchQuery
    />
  {/if}
</div>
