<script lang="ts">
import BookOpen from "@lucide/svelte/icons/book-open";
import History from "@lucide/svelte/icons/history";
import Search from "@lucide/svelte/icons/search";
import type { DashboardDashboardCopy } from "@/features/workspace/lib/dashboard-controller-types";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let description: string;
export let historyCalendarSemesterId: number | null = null;
export let showHistoryActions = false;
</script>

<OverviewSection title={dashboardCopy.termSelection.title}>
  <SoftEmptyMessage message={description} />
  <div class="mt-1 flex flex-wrap gap-2">
    <Button href={dashboardTabHref("subscriptions")}>
      <Search data-icon="inline-start" />
      {dashboardCopy.termSelection.matchByCode}
    </Button>
    <Button href="/catalog/sections" variant="outline">
      <BookOpen data-icon="inline-start" />
      {dashboardCopy.termSelection.browseSections}
    </Button>
    <Button href="/catalog/courses" variant="outline">
      {dashboardCopy.termSelection.browseCourses}
    </Button>
  </div>

  {#if showHistoryActions}
    <div class="mt-4 grid gap-3 border-t border-border/60 pt-4">
      <div class="flex min-w-0 items-start gap-2 text-muted-foreground text-sm">
        <History class="mt-0.5 size-4 shrink-0" />
        <span>{dashboardCopy.termSelection.historyAvailable}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button href={dashboardTabHref("homeworks")} variant="outline">
          {dashboardCopy.termSelection.viewPastHomeworks}
        </Button>
        <Button
          href={dashboardTabHref("calendar", {
            calendarSemester: historyCalendarSemesterId,
          })}
          variant="outline"
        >
          {dashboardCopy.termSelection.viewPastSchedule}
        </Button>
        <Button href={dashboardTabHref("subscriptions")} variant="outline">
          {dashboardCopy.termSelection.viewPastSections}
        </Button>
      </div>
    </div>
  {/if}
</OverviewSection>
