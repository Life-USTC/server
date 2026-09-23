<script lang="ts">
import { createExamTabDisplayActions } from "@/features/workspace/lib/exams-tab-display";
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import ExamsCardsView from "./ExamsCardsView.svelte";
import ExamsListView from "./ExamsListView.svelte";
import ExamsTabToolbar from "./ExamsTabToolbar.svelte";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
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
export let filteredExamRows: WorkspaceExamRow[];
export let locale: string;

$: ({ fmtExamDate } = createExamTabDisplayActions({
  locale,
  referenceNow: signedData.referenceNow,
  sectionCopy,
}));
function clearExamFilter() {
  examFilter = "all";
}
</script>

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
    <ExamsTabToolbar
      {workspaceCopy}
      {examFilter}
      onExamFilterChange={(value) => {
        examFilter = value;
      }}
    />

    <div class="md:hidden">
      <ExamsCardsView
        {workspaceCopy}
        {workspaceTabHref}
        {examMetadataLabels}
        exams={filteredExamRows}
        hasExamRows={examRows.length > 0}
        onClearFilter={clearExamFilter}
        {examTimeLabel}
        {fmtExamDate}
        {namePrimary}
        {sectionCopy}
        {subscriptionsCopy}
      />
    </div>
    <div class="hidden min-w-0 overflow-x-auto md:block">
      <ExamsListView
        {workspaceCopy}
        {workspaceTabHref}
        {examTimeLabel}
        exams={filteredExamRows}
        hasExamRows={examRows.length > 0}
        onClearFilter={clearExamFilter}
        {fmtExamDate}
        {sectionCopy}
        {subscriptionsCopy}
      />
    </div>
  {/if}
</section>
