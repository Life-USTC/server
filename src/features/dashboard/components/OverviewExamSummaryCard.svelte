<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

import OverviewViewAllFooter from "./OverviewViewAllFooter.svelte";

export let calendarExamDetail: (exam: DashboardOverviewExamItem) => string;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let examsCount: number;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let sectionCopy: DashboardSectionCopy;
export let upcomingExams: DashboardOverviewExamItem[];
export let previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      <a class="no-underline hover:underline" href={dashboardTabHref("exams")}>{dashboardCopy.nav.exams.title}</a>
    </Card.Title>
    <Card.Action>
      <Badge variant="outline">{examsCount}</Badge>
    </Card.Action>
  </Card.Header>
  <Card.Content>
    <Item.Group>
      {#each upcomingExams.slice(0, previewLimit) as exam}
        <Item.Root variant="outline" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("exams")} {...props}>
              <Item.Content>
                <Item.Title>{exam.courseName}</Item.Title>
                <Item.Description>{calendarExamDetail(exam) || sectionCopy.dateTBD}</Item.Description>
              </Item.Content>
              <Item.Actions>{fmtDate(exam.date)}</Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
      {:else}
        <Empty.Root class="min-h-24">
          <Empty.Header>
            <Empty.Title>{dashboardCopy.radar.empty}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Item.Group>
  </Card.Content>
  <OverviewViewAllFooter
    href={dashboardTabHref("exams")}
    label={viewAllLabel}
    visible={upcomingExams.length > previewLimit}
  />
</Card.Root>
