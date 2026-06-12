<script lang="ts">
import type { DashboardDashboardCopy } from "@/features/dashboard/lib/dashboard-controller-helpers";
import CalendarWeekStrip from "$lib/components/calendar/CalendarWeekStrip.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import type { OverviewWeekDay } from "./overview-tab-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let days: OverviewWeekDay[];
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>
      <a class="no-underline hover:underline" href={dashboardTabHref("calendar")}>{dashboardCopy.week.title}</a>
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <CalendarWeekStrip
      {days}
      emptyLabel={dashboardCopy.openSlot}
      moreLabel={(count) =>
        formatMessage(dashboardCopy.moreItems, {
          count: String(count),
        })}
    />
  </Card.Content>
</Card.Root>
