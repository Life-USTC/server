<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";

export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let pendingHomeworks: DashboardHomeworkItem[];
export let previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<OverviewSection
  href={dashboardTabHref("homeworks")}
  title={dashboardCopy.homeworks.titleV2}
  viewAllHref={dashboardTabHref("homeworks")}
  viewAllLabel={viewAllLabel}
  viewAllVisible={pendingHomeworks.length > previewLimit}
>
  {#if pendingHomeworks.length === 0}
    <SoftEmptyMessage message={dashboardCopy.homeworks.empty} />
  {:else}
    <ul class="divide-y divide-border/60">
      {#each pendingHomeworks.slice(0, previewLimit) as homework}
        <li>
          <a
            class="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={homework.section?.jwId
              ? sectionDetailHomeworkPath(homework.section.jwId, {
                  homeworkId: homework.id,
                })
              : dashboardTabHref("homeworks")}
          >
            <span class="grid min-w-0 gap-0.5">
              <span class="font-medium text-sm">{homework.title}</span>
              <span class="text-muted-foreground text-xs">
                {homework.section?.course?.namePrimary ?? commonCopy.sections}
              </span>
            </span>
            <span class="grid shrink-0 justify-items-end gap-0.5 text-xs">
              <span class="text-foreground">{homeworkEtaLabel(homework.submissionDueAt)}</span>
              <span class="text-muted-foreground tabular-nums"
                >{fmtDate(homework.submissionDueAt)}</span
              >
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</OverviewSection>
