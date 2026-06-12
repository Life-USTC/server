<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import SubscriptionsSectionDesktopTable from "./SubscriptionsSectionDesktopTable.svelte";
import SubscriptionsSectionMobileList from "./SubscriptionsSectionMobileList.svelte";

type SubscriptionSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];
type SubscriptionSectionGroup = {
  key: string;
  label: string;
  startDate: string | null;
  sections: SubscriptionSection[];
};

export let dashboardCopy: DashboardDashboardCopy;
export let group: SubscriptionSectionGroup;
export let pendingRemoveSectionId: SubscriptionSection["id"] | null;
export let removeSubscribedSection: (
  sectionId: SubscriptionSection["id"],
) => void | Promise<void>;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
</script>

<SubscriptionsSectionMobileList
  {dashboardCopy}
  {pendingRemoveSectionId}
  {removeSubscribedSection}
  {removingSectionId}
  {sectionCopy}
  sections={group.sections}
  {subscriptionsCopy}
/>

<SubscriptionsSectionDesktopTable
  {dashboardCopy}
  {pendingRemoveSectionId}
  {removeSubscribedSection}
  {removingSectionId}
  {sectionCopy}
  sections={group.sections}
  {subscriptionsCopy}
/>
