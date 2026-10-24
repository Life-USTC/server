<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import WorkspaceCollection from "#lib/components/WorkspaceCollection.svelte";
import { createExamTabDisplayActions } from "@/features/workspace/lib/exams-tab-display";
import type { WorkspaceCardView } from "@/features/workspace/lib/view-preferences";
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import {
  examTableFields,
  filterExamTable,
} from "../lib/workspace-task-table-filters";
import ExamsCardsView from "./ExamsCardsView.svelte";
import ExamsListView from "./ExamsListView.svelte";
import ExamsTabToolbar from "./ExamsTabToolbar.svelte";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import WorkspaceTaskColumnFilter from "./WorkspaceTaskColumnFilter.svelte";
import type {
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
  WorkspaceExamFilter,
  WorkspaceExamRow,
  WorkspaceTabHref,
} from "./workspace-exam-component-types";

type SignedWorkspaceExamData = SignedWorkspaceData & {
  subscriptions: NonNullable<SignedWorkspaceData["subscriptions"]>;
};

export let workspaceCopy: WorkspaceCopy;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let signedData: SignedWorkspaceExamData;

export let workspaceTabHref: WorkspaceTabHref;
export let examTimeLabel: ExamTimeLabel;
export let examMetadataLabels: ExamMetadataLabels;
export let namePrimary: NamePrimary;

export let examFilter: WorkspaceExamFilter;
export let examRows: WorkspaceExamRow[];
let applied: Record<string, string> = { completion: "incomplete" };
let draft = { ...applied };
$: fields = examTableFields(signedData.copy, examRows);
$: filteredExamRows = filterExamTable(examRows, fields, applied);
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function applyFilters(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
}
export let locale: string;

let mobileView: WorkspaceCardView = "cards";

$: ({ fmtExamDate } = createExamTabDisplayActions({
  locale,
  referenceNow: signedData.referenceNow,
  sectionCopy,
}));
function clearExamFilter() {
  examFilter = "all";
  draft = {};
  applied = {};
}

$: showClearExamFilter =
  (applied.completion !== "incomplete" ||
    Object.keys(applied).some(
      (name) => name !== "completion" && Boolean(applied[name]),
    )) &&
  examRows.length > 0;
</script>

{#snippet columnFilter(names: string[], label: string, prefix: string)}
  <WorkspaceTaskColumnFilter fields={fields.filter((field) => names.includes(field.name))} values={draft} {applied} onchange={patchDraft} {label} prefix={`${prefix}-exam-${names[0]}`} labels={signedData.copy.common.tableFilters} formId="exam-table-filters" />
{/snippet}

{#snippet mobileColumns()}
  <div class="flex flex-wrap gap-3">
    {@render columnFilter(["course"], subscriptionsCopy.courseName, "mobile")}
    {@render columnFilter(["section", "semester"], subscriptionsCopy.section, "mobile")}
    {@render columnFilter(["examDate", "completion"], sectionCopy.examDate, "mobile")}
    {@render columnFilter(["startTime", "endTime", "examMode"], sectionCopy.examTime, "mobile")}
    {@render columnFilter(["rooms"], sectionCopy.room, "mobile")}
  </div>
{/snippet}

<section class="grid gap-4">
  {#if !hasWorkspaceSubscriptions(signedData)}
    <WorkspaceNoSubscriptionsState
      title={workspaceCopy.nav.exams.noSubscriptionsTitle}
      description={workspaceCopy.nav.exams.noSubscriptionsDescription}
      actions={[
        { href: "/catalog/sections", label: subscriptionsCopy.browseSections },
        { href: "/catalog/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
      ]}
    />
  {:else}
    <form id="exam-table-filters" onsubmit={applyFilters} class="flex flex-wrap items-center gap-3" data-slot="table-filter-apply">
      {#each fields.filter((field) => ["examType", "examBatch", "examTakeCount"].includes(field.name)) as field}
        {@render columnFilter([field.name], field.label, "extra")}
      {/each}
      <Button type="submit">{signedData.copy.common.applyFilters}</Button>
    </form>
    <WorkspaceCollection>
      {#snippet mobile()}
        <div class="mb-3 flex items-center justify-between gap-2" data-slot="collection-header">
          {#if mobileView === "cards"}{@render mobileColumns()}{/if}
          <ExamsTabToolbar
            {workspaceCopy}
            {mobileView}
            onMobileViewChange={(value) => { mobileView = value; }}
          />
        </div>
        {#if mobileView === "cards"}
          <ExamsCardsView
            {locale}
            unknownSemesterLabel={signedData.copy.common.unknown}
            {workspaceCopy}
            {workspaceTabHref}
            {examMetadataLabels}
            exams={filteredExamRows}
            hasExamRows={examRows.length > 0}
            showClearFilter={showClearExamFilter}
            onClearFilter={clearExamFilter}
            {examTimeLabel}
            {fmtExamDate}
            {namePrimary}
            {sectionCopy}
            {subscriptionsCopy}
          />
        {:else}
          <ExamsListView
        filterControls={columnFilter}
            {examMetadataLabels}
            {locale}
            unknownSemesterLabel={signedData.copy.common.unknown}
            {namePrimary}
            {workspaceCopy}
            {workspaceTabHref}
            {examTimeLabel}
            exams={filteredExamRows}
            hasExamRows={examRows.length > 0}
            showClearFilter={showClearExamFilter}
            onClearFilter={clearExamFilter}
            {fmtExamDate}
            {sectionCopy}
            {subscriptionsCopy}
          />
        {/if}
      {/snippet}
      {#snippet desktop()}
        <ExamsListView
        filterControls={columnFilter}
          {examMetadataLabels}
          {locale}
          unknownSemesterLabel={signedData.copy.common.unknown}
          {namePrimary}
          {workspaceCopy}
          {workspaceTabHref}
          {examTimeLabel}
          exams={filteredExamRows}
          hasExamRows={examRows.length > 0}
          showClearFilter={showClearExamFilter}
          onClearFilter={clearExamFilter}
          {fmtExamDate}
          {sectionCopy}
          {subscriptionsCopy}
        />
      {/snippet}
    </WorkspaceCollection>
  {/if}
</section>
