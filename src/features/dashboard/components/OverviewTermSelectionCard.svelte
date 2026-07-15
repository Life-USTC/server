<script lang="ts">
import type { DashboardDashboardCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let description: string;
export let historyCalendarSemesterId: number | null = null;
export let showHistoryActions = false;
</script>

<Card.Root>
  <Card.Header class="items-start gap-4">
    <div>
      <Card.Title>{dashboardCopy.termSelection.title}</Card.Title>
      <Card.Description class="mt-2">
        {description}
      </Card.Description>
      {#if showHistoryActions}
        <Card.Description class="mt-2">
          {dashboardCopy.termSelection.historyAvailable}
        </Card.Description>
      {/if}
    </div>
    <div class="flex flex-wrap gap-2">
      {#if showHistoryActions}
        <Button href={dashboardTabHref("homeworks")}>
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
      {/if}
      <Button href="/sections">{dashboardCopy.termSelection.browseSections}</Button>
      <Button href="/courses" variant="outline">{dashboardCopy.termSelection.browseCourses}</Button>
      <Button href={dashboardTabHref("subscriptions")} variant="outline">{dashboardCopy.termSelection.matchByCode}</Button>
    </div>
  </Card.Header>
</Card.Root>
