<script lang="ts">
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
export let pageDemo: DemoIdentity | null | undefined = null;

import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { sectionSummary } from "@/features/catalog/lib/catalog-list-display";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import { splitRoomLabels } from "@/features/rooms/lib/room-map-types";
import { createExamTabDisplayActions } from "@/features/workspace/lib/exams-tab-display";
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import { formatSemesterName } from "@/lib/text/format-semester-name";
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
  ExamDisplayRow,
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
  WorkspaceCardView,
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
  draft = {};
  applied = {};
}

$: showClearExamFilter =
  (applied.completion !== "incomplete" ||
    Object.keys(applied).some(
      (name) => name !== "completion" && Boolean(applied[name]),
    )) &&
  examRows.length > 0;
$: columns = {
  course: { names: ["course"], label: subscriptionsCopy.courseName },
  section: { names: ["section", "semester"], label: subscriptionsCopy.section },
  date: { names: ["examDate", "completion"], label: sectionCopy.examDate },
  time: {
    names: ["startTime", "endTime", "examMode"],
    label: sectionCopy.examTime,
  },
  rooms: { names: ["rooms"], label: sectionCopy.room },
};
$: exams = filteredExamRows.map(
  (exam): ExamDisplayRow => ({
    id: exam.id,
    href: exam.section.jwId
      ? `/catalog/sections/${exam.section.jwId}/schedule#exams`
      : workspaceTabHref("subscriptions"),
    course: sectionSummary(exam.section, locale),
    section: exam.section.code ?? subscriptionsCopy.section,
    semester: formatSemesterName(
      locale,
      namePrimary(exam.section.semester) || signedData.copy.common.unknown,
    ),
    date: exam.examDate ? fmtExamDate(exam.examDate) : sectionCopy.examDateTBD,
    time: examTimeLabel(exam.startTime, exam.endTime) || "—",
    status: exam.completed
      ? workspaceCopy.nav.exams.filterCompleted
      : workspaceCopy.nav.exams.filterIncomplete,
    mode: exam.examMode,
    metadata: examMetadataLabels(exam),
    rooms: exam.rooms,
  }),
);
</script>

{#snippet roomLinks(value: ExamDisplayRow["rooms"])}
  {#if value}
    <span class="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 align-middle">
      {#each splitRoomLabels(value) as room (room)}
        <RoomMapPreview {pageDemo} {locale} code={room} copy={workspaceCopy.roomMap} />
      {/each}
    </span>
  {:else}{sectionCopy.roomTbd}{/if}
{/snippet}

{#snippet empty()}
  <CollectionEmpty variant="filter-clear"
    title={examRows.length ? workspaceCopy.nav.exams.filterEmpty : workspaceCopy.nav.exams.empty}
    description={examRows.length ? workspaceCopy.nav.exams.filterEmptyDescription : workspaceCopy.nav.exams.emptyDescription}
    clearFilterLabel={workspaceCopy.nav.exams.clearFilter}
    onClearFilter={showClearExamFilter ? clearExamFilter : undefined}
  />
{/snippet}

{#snippet columnFilter(names: string[], label: string, prefix: string)}
  <WorkspaceTaskColumnFilter fields={fields.filter((field) => names.includes(field.name))} values={draft} {applied} onchange={patchDraft} {label} prefix={`${prefix}-exam-${names[0]}`} labels={signedData.copy.common.tableFilters} formId="exam-table-filters" />
{/snippet}

{#snippet mobileColumns()}
  <div class="flex flex-wrap gap-3">
    {#each Object.values(columns) as column}
      {@render columnFilter(column.names, column.label, "mobile")}
    {/each}
  </div>
{/snippet}

{#snippet examsList()}
  <ExamsListView {exams} {roomLinks} {empty} {sectionCopy} {columns} filterControls={columnFilter} />
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
    <ResponsiveCollection workspace>
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
          <ExamsCardsView {exams} {roomLinks} {empty} {sectionCopy} />
        {:else}
          {@render examsList()}
        {/if}
      {/snippet}
      {#snippet desktop()}
        {@render examsList()}
      {/snippet}
    </ResponsiveCollection>
  {/if}
</section>
