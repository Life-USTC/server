<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type CommentsPanelComponent from "@/features/comments/components/CommentsPanel.svelte";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import { createHomeworkTabDisplayActions } from "@/features/workspace/lib/homeworks-tab-display";
import type {
  HomeworkFilter,
  SignedWorkspaceData,
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceHomeworksCopy,
  WorkspaceMyHomeworksCopy,
  WorkspaceSectionCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { filterWorkspaceHomeworks } from "@/features/workspace/lib/workspace-homework-filter";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import { resolveWorkspaceTaskFilter } from "@/features/workspace/lib/workspace-task-filter";
import * as Alert from "$lib/components/ui/alert/index.js";
import HomeworksCardsView from "./HomeworksCardsView.svelte";
import HomeworksListView from "./HomeworksListView.svelte";
import HomeworksTabDialogs from "./HomeworksTabDialogs.svelte";
import HomeworksTabToolbar from "./HomeworksTabToolbar.svelte";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import type {
  WorkspaceHomeworkCreateSection,
  WorkspaceHomeworkCreateSectionGetter,
} from "./workspace-homework-create-types";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkOverduePredicate = (
  value: Date | string | null | undefined,
) => boolean;
type HomeworkAction = (homework: WorkspaceHomeworkItem) => string;
type HomeworkCopy = WorkspaceMyHomeworksCopy;
type HomeworksCopy = WorkspaceHomeworksCopy;

export let CommentsPanel: typeof CommentsPanelComponent;

export let commonCopy: WorkspaceCommonCopy;
export let workspaceCopy: WorkspaceCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let homeworksCopy: HomeworksCopy;
export let homeworkCopy: HomeworkCopy;
export let commentsCopy: CommentsCopy;
export let signedData: SignedWorkspaceData;
export let homeworkActionError: string;

export let locale: string;
export let referenceDate: Date | string;
export let selectedCreateHomeworkSection: WorkspaceHomeworkCreateSectionGetter;
export let openCreateHomeworkDialog: () => void;
export let applyHomeworkStartNow: () => void;
export let applyHomeworkDueInWeek: () => void;
export let applyHomeworkDueInMonth: () => void;
export let applyHomeworkDueAtSemesterEnd: () => void;
export let toggleHomeworkCompletion: (
  homework: WorkspaceHomeworkItem,
) => void | Promise<void>;
export let createHomeworkAction: SubmitFunction;

export let homeworkFilter: HomeworkFilter;
export let showCreateHomework: boolean;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let selectedHomework: WorkspaceHomeworkItem | null;
export let homeworkItems: WorkspaceHomeworkItem[];
export let homeworkSavingById: Record<string, boolean>;
export let createHomeworkError: string;
export let isCreatingHomework: boolean;
let fmtDate: HomeworkDateFormatter;
let homeworkCompletionActionLabel: HomeworkAction;
let homeworkCourseLabel: HomeworkAction;
let homeworkEtaLabel: HomeworkDateFormatter;
let homeworkIsOverdue: HomeworkOverduePredicate;
let homeworkSectionHref: HomeworkAction;
let homeworkSectionLabel: (section: WorkspaceHomeworkCreateSection) => string;
let homeworkStatus: HomeworkAction;

$: filteredHomeworkItems = filterWorkspaceHomeworks(
  homeworkItems,
  resolveWorkspaceTaskFilter(
    homeworkFilter,
    homeworkItems.some((item) => !item.completion),
  ),
);
$: displayHomeworkFilter = resolveWorkspaceTaskFilter(
  homeworkFilter,
  homeworkItems.some((item) => !item.completion),
);
$: hasHomeworkItems = homeworkItems.length > 0;

function clearHomeworkFilter() {
  homeworkFilter = "all";
}

$: ({
  fmtDate,
  homeworkCompletionActionLabel,
  homeworkCourseLabel,
  homeworkEtaLabel,
  homeworkIsOverdue,
  homeworkSectionHref,
  homeworkSectionLabel,
  homeworkStatus,
} = createHomeworkTabDisplayActions({
  workspaceCopy,
  homeworkCopy,
  homeworksCopy,
  locale,
  referenceDate,
  sectionCopy,
}));
</script>

<section class="grid gap-4">
  {#if !signedData.homeworks || !hasWorkspaceSubscriptions(signedData)}
    <WorkspaceNoSubscriptionsState
      title={homeworkCopy.noSubscriptions}
      description={homeworkCopy.noSubscriptionsDescription}
      actions={[
        { href: "/catalog/sections", label: commonCopy.sections },
        { href: "/catalog/courses", label: commonCopy.courses, variant: "outline" },
      ]}
    />
  {:else}
    <HomeworksTabToolbar
      {homeworksCopy}
      homeworkFilter={displayHomeworkFilter}
      onHomeworkFilterChange={(value) => {
        homeworkFilter = value;
      }}
      {openCreateHomeworkDialog}
    />

    {#if homeworkActionError}
      <Alert.Root variant="destructive">
        <Alert.Description>{homeworkActionError}</Alert.Description>
      </Alert.Root>
    {/if}

    <div class="md:hidden">
      <HomeworksCardsView
        {filteredHomeworkItems}
        {hasHomeworkItems}
        onClearFilter={clearHomeworkFilter}
        {fmtDate}
        {homeworkCompletionActionLabel}
        {homeworkCopy}
        {homeworkEtaLabel}
        {homeworkIsOverdue}
        {homeworkSectionHref}
        {homeworksCopy}
        {homeworkSavingById}
        bind:selectedHomework
        {toggleHomeworkCompletion}
      />
    </div>
    <div class="hidden min-w-0 overflow-x-auto md:block">
      <HomeworksListView
        {filteredHomeworkItems}
        {hasHomeworkItems}
        onClearFilter={clearHomeworkFilter}
        {fmtDate}
        {homeworkCompletionActionLabel}
        {homeworkCopy}
        {homeworkEtaLabel}
        {homeworkIsOverdue}
        {homeworkSectionHref}
        {homeworksCopy}
        {homeworkSavingById}
        bind:selectedHomework
        {toggleHomeworkCompletion}
      />
    </div>

    <HomeworksTabDialogs
      {CommentsPanel}
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
      {homeworkCourseLabel}
      {homeworksCopy}
      {homeworkSavingById}
      {homeworkSectionHref}
      {homeworkSectionLabel}
      {isCreatingHomework}
      {locale}
      {referenceDate}
      sections={signedData.homeworks.sections}
      bind:selectedHomework
      {selectedCreateHomeworkSection}
      bind:showCreateHomework
      {toggleHomeworkCompletion}
    />
  {/if}
</section>
