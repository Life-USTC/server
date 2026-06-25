<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinAction,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
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

function pinLabel(link: DashboardOverviewLinkItem) {
  return link.isPinned
    ? dashboardCopy.linkHub.unpin
    : dashboardCopy.linkHub.pin;
}

function pinAction(link: DashboardOverviewLinkItem): DashboardLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {#each links.slice(0, 4) as link}
    <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/40">
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
    <Alert>{dashboardCopy.linkHub.empty}</Alert>
  {/each}
</div>
