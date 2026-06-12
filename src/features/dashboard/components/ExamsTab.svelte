<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  ExamView,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
import { Alert } from "$lib/components/ui/alert/index.js";
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
      <Alert>{dashboardCopy.nav.exams.empty}</Alert>
    {:else if filteredExamRows.length === 0}
      <Alert>{dashboardCopy.nav.exams.filterEmpty}</Alert>
    {:else if examView === "list"}
      <ExamsListView
        {dashboardCopy}
        {dashboardTabHref}
        {examTimeLabel}
        exams={filteredExamRows}
        {sectionCopy}
        {subscriptionsCopy}
      />
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
