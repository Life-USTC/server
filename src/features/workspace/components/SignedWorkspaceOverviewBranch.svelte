<script lang="ts">
import type {
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
  WorkspacePageData,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import OverviewTab from "./OverviewTab.svelte";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewSignedData,
} from "./overview-tab-types";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;
export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let data: WorkspacePageData;
export let linkIconLabel: (icon: string) => string;
export let overviewLinkItems: WorkspaceOverviewLinkItem[];
export let signedData: OverviewSignedData;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
</script>

<OverviewTab
  {workspaceCopy}
  {subscriptionsCopy}
  {signedData}
  locale={data.locale}
  {workspaceTabHref}
  {submitWorkspaceLinkPin}
  {linkIconLabel}
  {calendarTimelineItemsForDay}
  {overviewLinkItems}
  {updatingCatalogLinkSlug}
/>
