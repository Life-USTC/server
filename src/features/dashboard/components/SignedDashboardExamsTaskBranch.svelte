<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  ExamView,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import type {
  DashboardExamFilter,
  DashboardExamRow,
  DashboardTabHref,
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
} from "./dashboard-exam-component-types";
import ExamsTab from "./ExamsTab.svelte";

type SignedDashboardExamData = SignedDashboardData & {
  subscriptions: NonNullable<SignedDashboardData["subscriptions"]>;
};

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardTabHref;
export let examFilter: DashboardExamFilter;
export let examMetadataLabels: ExamMetadataLabels;
export let examRows: DashboardExamRow[];
export let examTimeLabel: ExamTimeLabel;
export let examView: ExamView;
export let filteredExamRows: DashboardExamRow[];
export let namePrimary: NamePrimary;
export let sectionCopy: DashboardSectionCopy;
export let setExamView: (view: ExamView) => void;
export let signedData: SignedDashboardExamData;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
</script>

<ExamsTab
  {dashboardCopy}
  {subscriptionsCopy}
  {sectionCopy}
  {signedData}
  {dashboardTabHref}
  {examTimeLabel}
  {examMetadataLabels}
  {namePrimary}
  {setExamView}
  {examView}
  {examRows}
  {filteredExamRows}
  bind:examFilter
/>
