<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import type CommentsPanelComponent from "@/features/comments/components/CommentsPanel.svelte";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import HomeworkCreateDialog from "@/features/homeworks/components/HomeworkCreateDialog.svelte";
import HomeworkDetailDialog from "@/features/homeworks/components/HomeworkDetailDialog.svelte";
import { canCompletePersonalHomework } from "@/features/homeworks/lib/homework-capabilities";
import {
  formatHomeworkDetailDateTime,
  formatHomeworkDueRelativeTime,
  normalizeHomeworkDetail,
} from "@/features/homeworks/lib/homework-presentation";
import { createHomeworkTabDisplayActions } from "@/features/workspace/lib/homeworks-tab-display";
import type {
  SignedWorkspaceData,
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceHomeworksCopy,
  WorkspaceMyHomeworksCopy,
  WorkspaceSectionCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import type { SubmitFunction } from "$app/forms";
import { withoutTaskFilter } from "../lib/workspace-task-filter-state";
import {
  filterHomeworkTable,
  homeworkTableFields,
} from "../lib/workspace-task-table-filters";
import HomeworkCreateFormFields from "./HomeworkCreateFormFields.svelte";
import HomeworksCollection from "./HomeworksCollection.svelte";
import HomeworksTabToolbar from "./HomeworksTabToolbar.svelte";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import WorkspaceTaskFilterToolbar from "./WorkspaceTaskFilterToolbar.svelte";
import type { WorkspaceHomeworkCreateSection } from "./workspace-homework-create-types";

type HomeworkDateFormatter = (
  value: Date | string | null | undefined,
) => string;
type HomeworkOverduePredicate = (
  value: Date | string | null | undefined,
) => boolean;
type HomeworkAction = (homework: WorkspaceHomeworkItem) => string;
type HomeworkCopy = WorkspaceMyHomeworksCopy;
type HomeworksCopy = WorkspaceHomeworksCopy;

export let canWriteShared = false;
export let readOnlyReason: string | null | undefined = null;
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
export let openCreateHomeworkDialog: () => void;
export let toggleHomeworkCompletion: (
  homework: WorkspaceHomeworkItem,
) => void | Promise<void>;
export let createHomeworkAction: SubmitFunction;

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

let applied: Record<string, string> = { completion: "incomplete" };
let draft = { ...applied };
$: fields = homeworkTableFields(
  { homeworks: homeworksCopy, common: commonCopy },
  homeworkItems,
).map((field) => ({
  ...field,
  label:
    field.name === "completion"
      ? commonCopy.taskFilters.myStatus
      : field.name === "flags"
        ? commonCopy.taskFilters.attributes
        : field.label,
}));
$: filteredHomeworkItems = filterHomeworkTable(
  homeworkItems,
  fields,
  applied,
  new Date(referenceDate),
);
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function removeFilter(name: string) {
  applied = withoutTaskFilter(applied, name);
  draft = withoutTaskFilter(draft, name);
}
function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
$: hasHomeworkItems = homeworkItems.length > 0;

function clearHomeworkFilter() {
  draft = {};
  applied = {};
}

$: showClearHomeworkFilter =
  (applied.completion !== "incomplete" ||
    Object.keys(applied).some(
      (name) => name !== "completion" && Boolean(applied[name]),
    )) &&
  homeworkItems.length > 0;

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
$: selectedHomeworkDetail = selectedHomework
  ? normalizeHomeworkDetail(selectedHomework, {
      contextHref: homeworkSectionHref(selectedHomework),
      contextLabel: homeworkCourseLabel(selectedHomework),
    })
  : null;
$: selectedHomeworkPermalinkBaseHref = selectedHomework?.section?.jwId
  ? commentTargetPermalinkBaseHref({
      homeworkId: selectedHomework.id,
      sectionJwId: selectedHomework.section.jwId,
      type: "homework",
    })
  : null;
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
      {canWriteShared}
      {readOnlyReason}
      homeworksCopy={homeworksCopy}
      openCreateHomeworkDialog={openCreateHomeworkDialog}
    />

    {#if signedData.homeworkCapabilities?.canComplete && !canWriteShared && !signedData.demo}
      <Alert.Root><Alert.Description>{homeworksCopy.suspended}</Alert.Description></Alert.Root>
    {/if}

    {#if homeworkActionError}
      <Alert.Root variant="destructive">
        <Alert.Description>{homeworkActionError}</Alert.Description>
      </Alert.Root>
    {/if}

    <WorkspaceTaskFilterToolbar id="homework-table-filters" {fields} commonNames={["completion", "course", "semester", "submissionDueAt"]} {draft} {applied} copy={commonCopy} sortLabel={commonCopy.taskFilters.homeworkSort} onchange={patchDraft} onapply={applyFilters} onreset={clearHomeworkFilter} onremove={removeFilter} />
    <HomeworksCollection
      showPersonalStatus={!signedData.demo}
      {readOnlyReason}
      {locale}
      unknownSemesterLabel={commonCopy.unknown}
      {filteredHomeworkItems}
      {hasHomeworkItems}
      showClearFilter={showClearHomeworkFilter}
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

    {#if canWriteShared && !readOnlyReason}
      <HomeworkCreateDialog
        open={showCreateHomework}
        copy={homeworksCopy}
        submitAction={createHomeworkAction}
        saving={isCreatingHomework}
        testId="workspace-homework-create"
        onClose={() => {
          showCreateHomework = false;
          createHomeworkError = "";
        }}
      >
        <HomeworkCreateFormFields
          {locale}
          {commentsCopy}
          {createHomeworkError}
          bind:createHomeworkAdvancedOpen
          bind:createHomeworkPublishedAt
          bind:createHomeworkSectionId
          bind:createHomeworkSubmissionDueAt
          bind:createHomeworkSubmissionStartAt
          {homeworkSectionLabel}
          {homeworksCopy}
          {isCreatingHomework}
          sections={signedData.homeworks.sections}
        />
      </HomeworkCreateDialog>
    {/if}

    <HomeworkDetailDialog
      showPersonalStatus={!signedData.demo}
      {readOnlyReason}
      freezeReferenceTime={Boolean(readOnlyReason)}
      {CommentsPanel}
      completionSaving={selectedHomework ? homeworkSavingById[selectedHomework.id] : false}
      contextHref={selectedHomeworkDetail?.contextHref}
      contextLabel={selectedHomeworkDetail?.contextLabel}
      copy={homeworksCopy}
      dateFallback={homeworksCopy.dateTBD}
      fmtDate={(value) =>
        formatHomeworkDetailDateTime(value, locale, homeworksCopy.dateTBD)}
      homework={selectedHomeworkDetail}
      onClose={() => {
        selectedHomework = null;
      }}
      onToggleCompletion={() => {
        if (selectedHomework) return toggleHomeworkCompletion(selectedHomework);
      }}
      permalinkBaseHref={selectedHomeworkPermalinkBaseHref}
      relativeEtaLabel={(value, liveReferenceDate) =>
        formatHomeworkDueRelativeTime(
          value,
          liveReferenceDate,
          locale,
          homeworksCopy.dateTBD,
        )}
      {referenceDate}
      showCompletion={(canCompletePersonalHomework({isAuthenticated: !signedData.demo}) && selectedHomework !== null) || Boolean(readOnlyReason)}
    >
      {#snippet contextActions()}
        {#if selectedHomeworkPermalinkBaseHref}
          <Button href={selectedHomeworkPermalinkBaseHref} variant="outline" class="w-full whitespace-normal text-center sm:w-auto">
            {homeworksCopy.openFullDetails}
          </Button>
        {/if}
      {/snippet}
    </HomeworkDetailDialog>
  {/if}
</section>
