<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let calendarExamDetail: (exam: DashboardOverviewExamItem) => string;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let examsCount: number;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let sectionCopy: DashboardSectionCopy;
export let upcomingExams: DashboardOverviewExamItem[];
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("exams")}>{dashboardCopy.nav.exams.title}</a>
      </Card.Title>
      <Badge variant="outline">{examsCount}</Badge>
    </div>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2">
      {#each upcomingExams.slice(0, 5) as exam}
        <a
          class="flex items-start justify-between gap-3 rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
          href={dashboardTabHref("exams")}
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{exam.courseName}</span>
            <span class="block truncate text-base-content/60 text-sm">{calendarExamDetail(exam) || sectionCopy.dateTBD}</span>
          </span>
          <span class="shrink-0 text-base-content/60 text-xs">{fmtDate(exam.date)}</span>
        </a>
      {:else}
        <Alert>{dashboardCopy.radar.empty}</Alert>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
