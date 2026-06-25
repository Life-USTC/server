<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import DashboardLinkVisitAction from "./DashboardLinkVisitAction.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let links: DashboardOverviewLinkItem[];
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let pinAction: (
  link: DashboardOverviewLinkItem,
) => DashboardLinkPinAction;
export let pinLabel: (link: DashboardOverviewLinkItem) => string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {#each links as link}
    <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/50">
      <DashboardLinkVisitAction {link} {linkIconLabel} reserveActionSpace />
      <div class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
        <LinksTabPinButton
          {link}
          {linkReturnTo}
          {pinAction}
          {pinLabel}
          {submitDashboardLinkPin}
          {updatingDashboardLinkSlug}
        />
      </div>
    </div>
  {/each}
</div>
