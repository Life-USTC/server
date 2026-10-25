<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import WorkspaceCollection from "#lib/components/WorkspaceCollection.svelte";
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
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import type { SubmitFunction } from "$app/forms";
import {
  filterHomeworkTable,
  homeworkTableFields,
} from "../lib/workspace-task-table-filters";
import HomeworksCardsView from "./HomeworksCardsView.svelte";
import HomeworksListView from "./HomeworksListView.svelte";
import HomeworksTabDialogs from "./HomeworksTabDialogs.svelte";
import HomeworksTabToolbar from "./HomeworksTabToolbar.svelte";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import WorkspaceTaskColumnFilter from "./WorkspaceTaskColumnFilter.svelte";
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
export let applyHomeworkStartNow: () => void;
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

let applied: Record<string, string> = { completion: "incomplete" };
let draft = { ...applied };
$: fields = homeworkTableFields(
  { homeworks: homeworksCopy, common: commonCopy },
  homeworkItems,
);
$: filteredHomeworkItems = filterHomeworkTable(
  homeworkItems,
  fields,
  applied,
  new Date(referenceDate),
);
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
$: hasHomeworkItems = homeworkItems.length > 0;

function clearHomeworkFilter() {
  homeworkFilter = "all";
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
</script>

{#snippet columnFilter(names: string[], label: string, prefix: string)}
  <WorkspaceTaskColumnFilter fields={fields.filter((field) => names.includes(field.name))} values={draft} {applied} onchange={patchDraft} {label} prefix={`${prefix}-homework-${names[0]}`} labels={commonCopy.tableFilters} formId="homework-table-filters" />
{/snippet}

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
      {readOnlyReason}
      homeworksCopy={homeworksCopy}
      openCreateHomeworkDialog={openCreateHomeworkDialog}
    />

    {#if homeworkActionError}
      <Alert.Root variant="destructive">
        <Alert.Description>{homeworkActionError}</Alert.Description>
      </Alert.Root>
    {/if}

    <form id="homework-table-filters" onsubmit={applyFilters} class="flex flex-wrap items-center gap-3" data-slot="table-filter-apply">
      {#each fields.filter((field) => ["section", "publishedAt", "submissionStartAt", "description"].includes(field.name)) as field}
        {@render columnFilter([field.name], field.label, "extra")}
      {/each}
      <Button type="submit">{commonCopy.applyFilters}</Button>
    </form>
    <WorkspaceCollection>
      {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        {@render columnFilter(["course", "semester"], homeworksCopy.sectionLabel, "mobile")}
        {@render columnFilter(["title"], homeworksCopy.titleLabel, "mobile")}
        {@render columnFilter(["submissionDueAt"], homeworksCopy.submissionDue, "mobile")}
        {@render columnFilter(["completion", "flags"], homeworksCopy.statusLabel, "mobile")}
      </div>
        <HomeworksCardsView
      {readOnlyReason}
          locale={locale}
          unknownSemesterLabel={commonCopy.unknown}
          filteredHomeworkItems={filteredHomeworkItems}
          hasHomeworkItems={hasHomeworkItems}
          showClearFilter={showClearHomeworkFilter}
          onClearFilter={clearHomeworkFilter}
          fmtDate={fmtDate}
          homeworkCompletionActionLabel={homeworkCompletionActionLabel}
          homeworkCopy={homeworkCopy}
          homeworkEtaLabel={homeworkEtaLabel}
          homeworkIsOverdue={homeworkIsOverdue}
          homeworkSectionHref={homeworkSectionHref}
          homeworksCopy={homeworksCopy}
          homeworkSavingById={homeworkSavingById}
          bind:selectedHomework
          toggleHomeworkCompletion={toggleHomeworkCompletion}
        />
      {/snippet}
      {#snippet desktop()}
        <HomeworksListView
      {readOnlyReason}
        filterControls={columnFilter}
          locale={locale}
          unknownSemesterLabel={commonCopy.unknown}
          filteredHomeworkItems={filteredHomeworkItems}
          hasHomeworkItems={hasHomeworkItems}
          showClearFilter={showClearHomeworkFilter}
          onClearFilter={clearHomeworkFilter}
          fmtDate={fmtDate}
          homeworkCompletionActionLabel={homeworkCompletionActionLabel}
          homeworkCopy={homeworkCopy}
          homeworkEtaLabel={homeworkEtaLabel}
          homeworkIsOverdue={homeworkIsOverdue}
          homeworkSectionHref={homeworkSectionHref}
          homeworksCopy={homeworksCopy}
          homeworkSavingById={homeworkSavingById}
          bind:selectedHomework
          toggleHomeworkCompletion={toggleHomeworkCompletion}
        />
      {/snippet}
    </WorkspaceCollection>

    <HomeworksTabDialogs
      {readOnlyReason}
      CommentsPanel={CommentsPanel}
      applyHomeworkDueAtSemesterEnd={applyHomeworkDueAtSemesterEnd}
      applyHomeworkStartNow={applyHomeworkStartNow}
      commentsCopy={commentsCopy}
      createHomeworkAction={createHomeworkAction}
      bind:createHomeworkAdvancedOpen
      bind:createHomeworkError
      bind:createHomeworkPublishedAt
      bind:createHomeworkSectionId
      bind:createHomeworkSubmissionDueAt
      bind:createHomeworkSubmissionStartAt
      homeworkCourseLabel={homeworkCourseLabel}
      homeworksCopy={homeworksCopy}
      homeworkSavingById={homeworkSavingById}
      homeworkSectionHref={homeworkSectionHref}
      homeworkSectionLabel={homeworkSectionLabel}
      isCreatingHomework={isCreatingHomework}
      locale={locale}
      referenceDate={referenceDate}
      sections={signedData.homeworks.sections}
      bind:selectedHomework
      bind:showCreateHomework
      toggleHomeworkCompletion={toggleHomeworkCompletion}
    />
  {/if}
</section>
