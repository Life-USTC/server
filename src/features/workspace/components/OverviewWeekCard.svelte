<script lang="ts">
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-helpers";
import CalendarWeekStrip from "$lib/components/calendar/CalendarWeekStrip.svelte";
import OverviewSection from "./OverviewSection.svelte";
import type { OverviewWeekDay } from "./overview-tab-types";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let days: OverviewWeekDay[];
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<OverviewSection
  href={workspaceTabHref("calendar")}
  testId="workspace-overview-week"
  title={workspaceCopy.week.title}
>
  <CalendarWeekStrip
    {days}
    emptyLabel={workspaceCopy.openSlot}
    moreLabel={(count) =>
      formatMessage(workspaceCopy.moreItems, {
        count: String(count),
      })}
  />
</OverviewSection>
