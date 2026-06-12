<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let pendingHomeworks: DashboardHomeworkItem[];
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("homeworks")}>{dashboardCopy.nav.homeworks.title}</a>
      </Card.Title>
    </div>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2">
      {#each pendingHomeworks.slice(0, 5) as homework}
        <a
          class="flex items-start justify-between gap-3 rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
          href={homework.section?.jwId
            ? `/sections/${homework.section.jwId}#homework-${homework.id}`
            : dashboardTabHref("homeworks")}
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{homework.title}</span>
            <span class="block truncate text-base-content/60 text-sm">{homework.section?.course?.namePrimary ?? commonCopy.sections}</span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block font-medium text-warning">{homeworkEtaLabel(homework.submissionDueAt)}</span>
            <span class="block text-base-content/60 text-xs">{fmtDate(homework.submissionDueAt)}</span>
          </span>
        </a>
      {:else}
        <Alert>{dashboardCopy.homeworks.empty}</Alert>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
