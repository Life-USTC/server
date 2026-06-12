<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  DashboardPageData,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewTab from "./OverviewTab.svelte";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewSignedData,
} from "./overview-tab-types";

export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;
export let commonCopy: DashboardCommonCopy;
export let copy: DashboardRootCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let data: DashboardPageData;
export let linkIconLabel: (icon: string) => string;
export let overviewLinkItems: DashboardOverviewLinkItem[];
export let sectionCopy: DashboardSectionCopy;
export let signedData: OverviewSignedData;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let todoPriorityClass: (priority: string) => string;
export let todosCopy: DashboardTodosCopy;
export let updatingDashboardLinkSlug: string | null;
</script>

<OverviewTab
  {copy}
  {commonCopy}
  {dashboardCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {todosCopy}
  {signedData}
  locale={data.locale}
  {dashboardTabHref}
  {todoPriorityClass}
  {submitDashboardLinkPin}
  {linkIconLabel}
  {calendarTimelineItemsForDay}
  {overviewLinkItems}
  {updatingDashboardLinkSlug}
/>
