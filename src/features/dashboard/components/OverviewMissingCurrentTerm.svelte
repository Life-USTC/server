<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewLinkItem,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { formatMessage } from "@/features/dashboard/lib/overview";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
import OverviewTermSelectionCard from "./OverviewTermSelectionCard.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: DashboardOverviewLinkItem[];
export let pendingTodosCount: number;
export let signedData: SignedDashboardData;
export let submitDashboardLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingDashboardLinkSlug: string | null;
</script>

<OverviewLinksGrid
  {dashboardCopy}
  {dashboardTabHref}
  {linkIconLabel}
  {links}
  {submitDashboardLinkPin}
  {updatingDashboardLinkSlug}
/>

<OverviewTermSelectionCard
  {dashboardCopy}
  {dashboardTabHref}
  description={signedData.overview?.hasAnySelection
    ? dashboardCopy.termSelection.noCurrentTerm
    : dashboardCopy.termSelection.noAnySelection}
/>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{dashboardCopy.todos.title}</Card.Title>
    <Card.Description>
      {formatMessage(dashboardCopy.todos.pending, {
        count: pendingTodosCount,
      })}
    </Card.Description>
  </Card.Header>
</Card.Root>
