<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  ExamView,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
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
export let setExamView: (view: ExamView) => void;

export let examView: ExamView;
export let examFilter: DashboardExamFilter;
export let examRows: DashboardExamRow[];
export let filteredExamRows: DashboardExamRow[];
</script>

<section class="grid gap-4">
  {#if !hasDashboardSubscriptions(signedData)}
    <DashboardNoSubscriptionsState
      title={dashboardCopy.nav.exams.noSubscriptionsTitle}
      description={dashboardCopy.nav.exams.noSubscriptionsDescription}
      actions={[
        { href: "/sections", label: subscriptionsCopy.browseSections },
        { href: "/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
      ]}
    />
  {:else}
    <ExamsTabToolbar
      {dashboardCopy}
      bind:examFilter
      {examView}
      {setExamView}
    />

    {#if examRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Title>{dashboardCopy.nav.exams.empty}</Empty.Title>
          <Empty.Description>
            {dashboardCopy.nav.exams.emptyDescription}
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else if filteredExamRows.length === 0}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
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
    {:else if examView === "list"}
      <div class="md:hidden">
        <ExamsCardsView
          {dashboardCopy}
          {dashboardTabHref}
          {examMetadataLabels}
          exams={filteredExamRows}
          {examTimeLabel}
          {namePrimary}
          {sectionCopy}
          {subscriptionsCopy}
        />
      </div>
      <div class="hidden md:block">
        <ExamsListView
          {dashboardCopy}
          {dashboardTabHref}
          {examTimeLabel}
          exams={filteredExamRows}
          {sectionCopy}
          {subscriptionsCopy}
        />
      </div>
    {:else}
      <ExamsCardsView
        {dashboardCopy}
        {dashboardTabHref}
        {examMetadataLabels}
        exams={filteredExamRows}
        {examTimeLabel}
        {namePrimary}
        {sectionCopy}
        {subscriptionsCopy}
      />
    {/if}
  {/if}
</section>
