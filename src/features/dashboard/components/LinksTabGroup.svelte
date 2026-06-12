<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  LinkView,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import LinksTabGrid from "./LinksTabGrid.svelte";
import LinksTabList from "./LinksTabList.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let entry: SignedLinkGroup;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkView: LinkView;
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
  <h3 class="font-medium text-base-content/60 text-sm">
    {entry.label}
  </h3>
  {#if linkView === "grid"}
    <LinksTabGrid
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitDashboardLinkPin}
      {updatingDashboardLinkSlug}
    />
  {:else}
    <LinksTabList
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitDashboardLinkPin}
      {updatingDashboardLinkSlug}
    />
  {/if}
</section>
