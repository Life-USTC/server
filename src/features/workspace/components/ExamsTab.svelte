<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import { createExamTabDisplayActions } from "@/features/workspace/lib/exams-tab-display";
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import { resolveWorkspaceTaskFilter } from "@/features/workspace/lib/workspace-task-filter";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
$: displayExamFilter = resolveWorkspaceTaskFilter(
  examFilter,
  examRows.some((row) => !row.completed),
);
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
      examFilter={displayExamFilter}
      onExamFilterChange={(value) => {
        examFilter = value;
      }}
    />

    {#if examRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Media variant="icon"><BookOpenIcon /></Empty.Media>
          <Empty.Title>{workspaceCopy.nav.exams.empty}</Empty.Title>
          <Empty.Description>
            {workspaceCopy.nav.exams.emptyDescription}
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else if filteredExamRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Media variant="icon"><BookOpenIcon /></Empty.Media>
          <Empty.Title>{workspaceCopy.nav.exams.filterEmpty}</Empty.Title>
          <Empty.Description>
            {workspaceCopy.nav.exams.filterEmptyDescription}
          </Empty.Description>
        </Empty.Header>
        <Empty.Content class="items-start">
          <Button
            variant="outline"
            onclick={() => {
              examFilter = "all";
            }}
          >
            {workspaceCopy.nav.exams.clearFilter}
          </Button>
        </Empty.Content>
      </Empty.Root>
    {:else}
      <div class="md:hidden">
        <ExamsCardsView
          {workspaceCopy}
          {workspaceTabHref}
          {examMetadataLabels}
          exams={filteredExamRows}
          {examTimeLabel}
          {fmtExamDate}
          {namePrimary}
          {sectionCopy}
          {subscriptionsCopy}
        />
      </div>
      <div class="hidden min-w-0 overflow-x-auto md:block">
        <ExamsListView
          {workspaceTabHref}
          {examTimeLabel}
          exams={filteredExamRows}
          {fmtExamDate}
          {sectionCopy}
          {subscriptionsCopy}
        />
      </div>
    {/if}
  {/if}
</section>
