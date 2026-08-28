<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{dashboardCopy.radar.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    {@const examPreview = upcomingExams.slice(0, previewLimit)}
    <Item.Group class="gap-0">
      {#each examPreview as exam, index (exam.id)}
        <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("exams")} {...props}>
              <Item.Content class="min-w-0">
                <Item.Title>{exam.courseName}</Item.Title>
                <Item.Description>
                  {calendarExamDetail(exam) || sectionCopy.dateTBD}
                </Item.Description>
              </Item.Content>
              <Item.Actions class="shrink-0">
                <span class="text-muted-foreground text-xs tabular-nums">
                  {fmtDate(exam.date)}
                </span>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
        {#if index < examPreview.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  {/if}
</OverviewSection>
