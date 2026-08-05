<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import LinksTabGrid from "./LinksTabGrid.svelte";
import LinksTabList from "./LinksTabList.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let entry: SignedLinkGroup;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;

function pinLabel(link: DashboardOverviewLinkItem) {
  return link.isPinned
    ? dashboardCopy.linkHub.unpin
    : dashboardCopy.linkHub.pin;
}

function pinAction(link: DashboardOverviewLinkItem): DashboardLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<section class="grid gap-2">
  <h3 class="font-medium text-muted-foreground text-sm">
    {entry.label}
  </h3>
  <div class="xl:hidden">
    <LinksTabGrid
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitDashboardLinkPin}
      {updatingDashboardLinkSlug}
    />
  </div>
  <div class="hidden xl:block">
    <LinksTabList
      colActions={dashboardCopy.linkHub.colActions}
      colDescription={dashboardCopy.linkHub.colDescription}
      colName={dashboardCopy.linkHub.colName}
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitDashboardLinkPin}
      {updatingDashboardLinkSlug}
    />
  </div>
</section>
