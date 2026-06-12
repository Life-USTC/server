<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type CommentsPanelComponent from "@/features/comments/components/CommentsPanel.svelte";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardHomeworksCopy,
  DashboardMyHomeworksCopy,
  DashboardSectionCopy,
  HomeworkFilter,
  HomeworkView,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { filterDashboardHomeworks } from "@/features/dashboard/lib/dashboard-homework-filter";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
import { createHomeworkTabDisplayActions } from "@/features/dashboard/lib/homeworks-tab-display";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type {
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
} from "./dashboard-homework-create-types";
import HomeworksCardsView from "./HomeworksCardsView.svelte";
import HomeworksListView from "./HomeworksListView.svelte";
import HomeworksTabDialogs from "./HomeworksTabDialogs.svelte";
import HomeworksTabToolbar from "./HomeworksTabToolbar.svelte";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkAction = (homework: DashboardHomeworkItem) => string;
type HomeworkCopy = DashboardMyHomeworksCopy;
type HomeworksCopy = DashboardHomeworksCopy;

export let CommentsPanel: typeof CommentsPanelComponent;

export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let sectionCopy: DashboardSectionCopy;
export let homeworksCopy: HomeworksCopy;
export let homeworkCopy: HomeworkCopy;
export let commentsCopy: CommentsCopy;
export let signedData: SignedDashboardData;

export let HOMEWORK_TITLE_MAX_LENGTH: number;
export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let locale: string;
export let referenceDate: Date | string;
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let openCreateHomeworkDialog: () => void;
export let applyHomeworkStartNow: () => void;
export let applyHomeworkDueInWeek: () => void;
export let applyHomeworkDueInMonth: () => void;
export let applyHomeworkDueAtSemesterEnd: () => void;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;
export let setHomeworkView: (view: HomeworkView) => void;
export let createHomeworkAction: SubmitFunction;

export let homeworkFilter: HomeworkFilter;
export let homeworkView: HomeworkView;
export let showCreateHomework: boolean;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let selectedHomework: DashboardHomeworkItem | null;
export let homeworkItems: DashboardHomeworkItem[];
export let homeworkSavingById: Record<string, boolean>;
export let createHomeworkError: string;
export let isCreatingHomework: boolean;
let fmtDate: HomeworkDateFormatter;
let homeworkCompletionActionLabel: HomeworkAction;
let homeworkCourseLabel: HomeworkAction;
let homeworkDetailHref: HomeworkAction;
let homeworkEtaLabel: HomeworkDateFormatter;
let homeworkSectionHref: HomeworkAction;
let homeworkSectionLabel: (section: DashboardHomeworkCreateSection) => string;
let homeworkStatus: HomeworkAction;

$: filteredHomeworkItems = filterDashboardHomeworks(
  homeworkItems,
  homeworkFilter,
);

$: ({
  fmtDate,
  homeworkCompletionActionLabel,
  homeworkCourseLabel,
  homeworkDetailHref,
  homeworkEtaLabel,
  homeworkSectionHref,
  homeworkSectionLabel,
  homeworkStatus,
} = createHomeworkTabDisplayActions({
  dashboardCopy,
  homeworkCopy,
  homeworksCopy,
  locale,
  referenceDate,
  sectionCopy,
}));
</script>

<section class="grid gap-4">
  {#if !signedData.homeworks || !hasDashboardSubscriptions(signedData)}
    <DashboardNoSubscriptionsState
      title={homeworkCopy.noSubscriptions}
      description={homeworkCopy.noSubscriptionsDescription}
      actions={[
        { href: "/sections", label: commonCopy.sections },
        { href: "/courses", label: commonCopy.courses, variant: "outline" },
      ]}
    />
  {:else}
    <HomeworksTabToolbar
      {homeworksCopy}
      bind:homeworkFilter
      {homeworkView}
      {openCreateHomeworkDialog}
      {setHomeworkView}
    />

    {#if homeworkView === "list"}
      <HomeworksListView
        {filteredHomeworkItems}
        {fmtDate}
        {homeworkCompletionActionLabel}
        {homeworkCopy}
        {homeworkEtaLabel}
        {homeworksCopy}
        {homeworkSavingById}
        bind:selectedHomework
        {toggleHomeworkCompletion}
      />
    {:else}
      <HomeworksCardsView
        {filteredHomeworkItems}
        {fmtDate}
        {homeworkCompletionActionLabel}
        {homeworkCopy}
        {homeworkEtaLabel}
        {homeworksCopy}
        {homeworkSavingById}
        bind:selectedHomework
        {toggleHomeworkCompletion}
      />
    {/if}

    <HomeworksTabDialogs
      {CommentsPanel}
      {HOMEWORK_DESCRIPTION_MAX_LENGTH}
      {HOMEWORK_TITLE_MAX_LENGTH}
      {applyHomeworkDueAtSemesterEnd}
      {applyHomeworkDueInMonth}
      {applyHomeworkDueInWeek}
      {applyHomeworkStartNow}
      {commentsCopy}
      {createHomeworkAction}
      bind:createHomeworkAdvancedOpen
      bind:createHomeworkError
      bind:createHomeworkPublishedAt
      bind:createHomeworkSectionId
      bind:createHomeworkSubmissionDueAt
      bind:createHomeworkSubmissionStartAt
      {fmtDate}
      {homeworkCompletionActionLabel}
      {homeworkCopy}
      {homeworkCourseLabel}
      {homeworkDetailHref}
      {homeworkEtaLabel}
      {homeworksCopy}
      {homeworkSavingById}
      {homeworkSectionHref}
      {homeworkSectionLabel}
      {homeworkStatus}
      {isCreatingHomework}
      bind:selectedHomework
      {selectedCreateHomeworkSection}
      bind:showCreateHomework
      {signedData}
      {toggleHomeworkCompletion}
    />
  {/if}
</section>
