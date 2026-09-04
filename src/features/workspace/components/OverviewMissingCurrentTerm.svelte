<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewLinkItem,
  SignedDashboardData,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import { formatMessage } from "@/features/workspace/lib/overview";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
import OverviewSection from "./OverviewSection.svelte";
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

<div class="grid gap-8">
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
    historyCalendarSemesterId={signedData.overview?.calendar?.calendarSemesterPicker?.at(-1)?.id ?? null}
    showHistoryActions={signedData.overview?.hasAnySelection === true}
  />

  <OverviewSection
    href={dashboardTabHref("todos")}
    title={dashboardCopy.todos.title}
  >
    <p class="text-muted-foreground text-sm">
      {formatMessage(dashboardCopy.todos.pending, {
        count: pendingTodosCount,
      })}
    </p>
  </OverviewSection>
</div>
