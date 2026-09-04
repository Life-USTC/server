<script lang="ts">
import type {
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
  WorkspacePageData,
  WorkspaceRootCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import OverviewTab from "./OverviewTab.svelte";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewSignedData,
} from "./overview-tab-types";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;
export let commonCopy: WorkspaceCommonCopy;
export let copy: WorkspaceRootCopy;
export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let data: WorkspacePageData;
export let linkIconLabel: (icon: string) => string;
export let overviewLinkItems: WorkspaceOverviewLinkItem[];
export let sectionCopy: WorkspaceSectionCopy;
export let signedData: OverviewSignedData;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let todosCopy: WorkspaceTodosCopy;
export let updatingCatalogLinkSlug: string | null;
</script>

<OverviewTab
  {copy}
  {commonCopy}
  {workspaceCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {todosCopy}
  {signedData}
  locale={data.locale}
  {workspaceTabHref}
  {submitWorkspaceLinkPin}
  {linkIconLabel}
  {calendarTimelineItemsForDay}
  {overviewLinkItems}
  {updatingCatalogLinkSlug}
/>
