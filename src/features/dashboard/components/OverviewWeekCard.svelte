<script lang="ts">
import type { DashboardDashboardCopy } from "@/features/dashboard/lib/dashboard-controller-helpers";
import CalendarWeekStrip from "$lib/components/calendar/CalendarWeekStrip.svelte";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";
import type { OverviewWeekDay } from "./overview-tab-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let days: OverviewWeekDay[];
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<OverviewSection
  href={dashboardTabHref("calendar")}
  testId="dashboard-overview-week"
  title={dashboardCopy.week.title}
>
  <CalendarWeekStrip
    {days}
    emptyLabel={dashboardCopy.openSlot}
    moreLabel={(count) =>
      formatMessage(dashboardCopy.moreItems, {
        count: String(count),
      })}
  />
</OverviewSection>
