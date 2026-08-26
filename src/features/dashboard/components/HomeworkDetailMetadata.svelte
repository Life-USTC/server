<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailFormatter,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let homeworkStatus: DashboardHomeworkDetailAction;
</script>

<section class="grid gap-4 rounded-lg bg-muted/50 px-4 py-4">
  <dl class="grid gap-4">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <dt class="text-muted-foreground text-xs">{homeworksCopy.submissionDue}</dt>
        <dd class="mt-1 font-semibold text-base">{fmtDate(homework.submissionDueAt)}</dd>
        <dd class="mt-1 text-muted-foreground text-sm">
          {homeworkEtaLabel(homework.submissionDueAt)}
        </dd>
      </div>
      <Badge variant={homework.completion ? "default" : "secondary"}>
        {homeworkStatus(homework)}
      </Badge>
    </div>

    <div class="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div>
        <dt class="text-muted-foreground text-xs">{homeworksCopy.submissionStart}</dt>
        <dd class="mt-1 font-medium text-sm">{fmtDate(homework.submissionStartAt)}</dd>
      </div>
      <div>
        <dt class="text-muted-foreground text-xs">{homeworksCopy.homeworkPublishedAt}</dt>
        <dd class="mt-1 font-medium text-sm">{fmtDate(homework.publishedAt)}</dd>
      </div>
    </div>
  </dl>

  <div class="flex flex-wrap gap-2">
    {#if homework.isMajor}
      <Badge variant="secondary">{homeworksCopy.tagMajor}</Badge>
    {/if}
    {#if homework.requiresTeam}
      <Badge variant="outline">{homeworksCopy.tagTeam}</Badge>
    {/if}
  </div>
</section>
