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

<section class="grid gap-3 rounded-md border border-base-300 bg-base-200/40 p-4">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="font-medium text-base-content/70 text-xs uppercase tracking-wide">
        {homeworksCopy.submissionDue}
      </p>
      <p class="mt-1 font-semibold text-lg">
        {fmtDate(homework.submissionDueAt)}
      </p>
    </div>
    <Badge
      class={homework.completion
        ? "border-success/40 bg-success/10 text-success"
        : "border-warning/40 bg-warning/10 text-warning"}
    >
      {homeworkStatus(homework)}
    </Badge>
  </div>
  <p class="text-base-content/60 text-sm">
    {homeworkEtaLabel(homework.submissionDueAt)}
  </p>
  <div class="grid gap-3 border-base-300 border-t pt-3 sm:grid-cols-2">
    <div>
      <p class="text-base-content/60 text-xs">{homeworksCopy.submissionStart}</p>
      <p class="mt-1 font-medium text-sm">{fmtDate(homework.submissionStartAt)}</p>
    </div>
    <div>
      <p class="text-base-content/60 text-xs">{homeworksCopy.homeworkPublishedAt}</p>
      <p class="mt-1 font-medium text-sm">{fmtDate(homework.publishedAt)}</p>
    </div>
  </div>
</section>

<div class="flex flex-wrap gap-2">
  {#if homework.isMajor}
    <Badge class="border-warning/40 bg-warning/10 text-warning">
      {homeworksCopy.tagMajor}
    </Badge>
  {/if}
  {#if homework.requiresTeam}
    <Badge class="border-info/40 bg-info/10 text-info">
      {homeworksCopy.tagTeam}
    </Badge>
  {/if}
</div>
