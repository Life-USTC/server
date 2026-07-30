<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinAction,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import * as Empty from "$lib/components/ui/empty/index.js";
import OverviewViewAllFooter from "./OverviewViewAllFooter.svelte";
import DashboardLinkVisitAction from "./DashboardLinkVisitAction.svelte";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: DashboardOverviewLinkItem[];
export let submitDashboardLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingDashboardLinkSlug: string | null;

const previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
$: previewLinks = links.slice(0, previewLimit);

function pinLabel(link: DashboardOverviewLinkItem) {
  return link.isPinned
    ? dashboardCopy.linkHub.unpin
    : dashboardCopy.linkHub.pin;
}

function pinAction(link: DashboardOverviewLinkItem): DashboardLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<div data-testid="dashboard-overview-links">
  <div class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
  {#each previewLinks as link}
    <div class="group relative min-w-0 overflow-hidden rounded-lg">
      <DashboardLinkVisitAction {link} {linkIconLabel} reserveActionSpace />
      <div class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
        <LinksTabPinButton
          {link}
          linkReturnTo={dashboardTabHref("overview")}
          {pinAction}
          {pinLabel}
          {submitDashboardLinkPin}
          {updatingDashboardLinkSlug}
        />
      </div>
    </div>
  {:else}
    <Empty.Root class="min-h-24 sm:col-span-2 xl:col-span-4">
      <Empty.Header>
        <Empty.Title>{dashboardCopy.linkHub.empty}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}
  </div>
  <OverviewViewAllFooter
    href={dashboardTabHref("links")}
    label={dashboardCopy.viewAll as string}
    visible={links.length > previewLimit}
  />
</div>
