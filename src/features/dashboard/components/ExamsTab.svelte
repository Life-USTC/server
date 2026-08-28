<script lang="ts">
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
import { resolveDashboardTaskFilter } from "@/features/dashboard/lib/dashboard-task-filter";
import { createExamTabDisplayActions } from "@/features/dashboard/lib/exams-tab-display";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type {
  DashboardExamFilter,
  DashboardExamRow,
  DashboardTabHref,
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
} from "./dashboard-exam-component-types";
import ExamsCardsView from "./ExamsCardsView.svelte";
import ExamsListView from "./ExamsListView.svelte";
import ExamsTabToolbar from "./ExamsTabToolbar.svelte";

type SignedDashboardExamData = SignedDashboardData & {
  subscriptions: NonNullable<SignedDashboardData["subscriptions"]>;
};

export let dashboardCopy: DashboardDashboardCopy;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
export let sectionCopy: DashboardSectionCopy;
export let signedData: SignedDashboardExamData;

export let dashboardTabHref: DashboardTabHref;
export let examTimeLabel: ExamTimeLabel;
export let examMetadataLabels: ExamMetadataLabels;
export let namePrimary: NamePrimary;

export let examFilter: DashboardExamFilter;
export let examRows: DashboardExamRow[];
export let filteredExamRows: DashboardExamRow[];
export let locale: string;

$: ({ fmtExamDate } = createExamTabDisplayActions({
  locale,
  referenceNow: signedData.referenceNow,
  sectionCopy,
}));
$: displayExamFilter = resolveDashboardTaskFilter(
  examFilter,
  examRows.some((row) => !row.completed),
);
</script>

<section class="grid gap-4">
  {#if !hasDashboardSubscriptions(signedData)}
    <DashboardNoSubscriptionsState
      title={dashboardCopy.nav.exams.noSubscriptionsTitle}
      description={dashboardCopy.nav.exams.noSubscriptionsDescription}
      actions={[
        { href: "/catalog/sections", label: subscriptionsCopy.browseSections },
        { href: "/catalog/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
      ]}
    />
  {:else}
    <ExamsTabToolbar
      {dashboardCopy}
      examFilter={displayExamFilter}
      onExamFilterChange={(value) => {
        examFilter = value;
      }}
    />

    {#if examRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Media variant="icon"><BookOpenIcon /></Empty.Media>
          <Empty.Title>{dashboardCopy.nav.exams.empty}</Empty.Title>
          <Empty.Description>
            {dashboardCopy.nav.exams.emptyDescription}
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else if filteredExamRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Media variant="icon"><BookOpenIcon /></Empty.Media>
          <Empty.Title>{dashboardCopy.nav.exams.filterEmpty}</Empty.Title>
          <Empty.Description>
            {dashboardCopy.nav.exams.filterEmptyDescription}
          </Empty.Description>
        </Empty.Header>
        <Empty.Content class="items-start">
          <Button
            variant="outline"
            onclick={() => {
              examFilter = "all";
            }}
          >
            {dashboardCopy.nav.exams.clearFilter}
          </Button>
        </Empty.Content>
      </Empty.Root>
    {:else}
      <div class="md:hidden">
        <ExamsCardsView
          {dashboardCopy}
          {dashboardTabHref}
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
          {dashboardTabHref}
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
