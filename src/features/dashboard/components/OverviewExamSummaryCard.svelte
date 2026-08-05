<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";

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

<OverviewSection
  href={dashboardTabHref("exams")}
  title={dashboardCopy.radar.title}
  viewAllHref={dashboardTabHref("exams")}
  viewAllLabel={viewAllLabel}
  viewAllVisible={upcomingExams.length > previewLimit}
>
  {#snippet action()}
    <span class="text-muted-foreground text-xs tabular-nums">{examsCount}</span>
  {/snippet}

  {#if upcomingExams.length === 0}
    <SoftEmptyMessage message={dashboardCopy.radar.empty} />
  {:else}
    <ul class="divide-y divide-border/60">
      {#each upcomingExams.slice(0, previewLimit) as exam}
        <li>
          <a
            class="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={dashboardTabHref("exams")}
          >
            <span class="grid min-w-0 gap-0.5">
              <span class="font-medium text-sm">{exam.courseName}</span>
              <span class="text-muted-foreground text-xs">
                {calendarExamDetail(exam) || sectionCopy.dateTBD}
              </span>
            </span>
            <span class="shrink-0 text-muted-foreground text-xs tabular-nums">
              {fmtDate(exam.date)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</OverviewSection>
