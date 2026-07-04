<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let calendarExamDetail: (exam: DashboardOverviewExamItem) => string;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let examsCount: number;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let sectionCopy: DashboardSectionCopy;
export let upcomingExams: DashboardOverviewExamItem[];
</script>

<Card.Root>
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("exams")}>{dashboardCopy.nav.exams.title}</a>
      </Card.Title>
      <Badge variant="outline">{examsCount}</Badge>
    </div>
  </Card.Header>
  <Card.Content>
    <Item.Group>
      {#each upcomingExams.slice(0, 5) as exam}
        <Item.Root variant="outline" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("exams")} {...props}>
              <Item.Content>
                <Item.Title>{exam.courseName}</Item.Title>
                <Item.Description>{calendarExamDetail(exam) || sectionCopy.dateTBD}</Item.Description>
              </Item.Content>
              <Item.Actions class="text-muted-foreground text-xs">{fmtDate(exam.date)}</Item.Actions>
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
</Card.Root>
