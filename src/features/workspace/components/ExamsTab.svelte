<script lang="ts">
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

let mobileView: WorkspaceCardView = "cards";

$: ({ fmtExamDate } = createExamTabDisplayActions({
  locale,
  referenceNow: signedData.referenceNow,
  sectionCopy,
}));
function clearExamFilter() {
  examFilter = "all";
}

$: showClearExamFilter = examFilter !== "incomplete" && examRows.length > 0;
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
      {mobileView}
      onMobileViewChange={(value) => { mobileView = value; }}
      onExamFilterChange={(value) => {
        examFilter = value;
      }}
    />

    <WorkspaceCollection>
      {#snippet mobile()}
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
