<script lang="ts">
import type {
  HomeworkDateValue,
  HomeworkDeadlineState,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";
import type {
  HomeworkDetailCopy,
  HomeworkDetailDateFormatter,
  HomeworkDetailRelativeFormatter,
} from "./homework-detail-types";

export let copy: HomeworkDetailCopy;
export let dateFallback: string;
export let deadlineState: HomeworkDeadlineState;
export let fmtDate: HomeworkDetailDateFormatter;
export let homework: HomeworkDetailModel;
export let referenceDate: HomeworkDateValue;
export let relativeEtaLabel: HomeworkDetailRelativeFormatter;

$: dueLabel = fmtDate(homework.submissionDueAt) || dateFallback;
$: relativeLabel = relativeEtaLabel(homework.submissionDueAt, referenceDate);
$: isOverdue = deadlineState === "overdue";
</script>

<dl
  aria-label={copy.submissionDue}
  class="grid min-w-0 gap-3 rounded-xl bg-muted/40 p-4 sm:p-5"
  data-testid="homework-deadline-summary"
>
  <div class="min-w-0">
    <dt class="text-muted-foreground text-sm">{copy.submissionDue}</dt>
    <dd class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
      {dueLabel}
    </dd>
    {#if homework.submissionDueAt && relativeLabel}
      <dd
        aria-label={copy.relativeTime}
        class={cn(
          "mt-1 text-sm",
          isOverdue ? "text-destructive font-medium" : "text-muted-foreground",
        )}
      >
        {relativeLabel}
      </dd>
    {/if}
  </div>
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <dt class="sr-only">{copy.statusLabel}</dt>
    <dd class="contents">
      <Badge variant={homework.completed ? "secondary" : "outline"}>
        {homework.completed ? copy.completedLabel : copy.pendingLabel}
      </Badge>
      {#if homework.isMajor}
        <Badge variant="outline">{copy.tagMajor}</Badge>
      {/if}
      {#if homework.requiresTeam}
        <Badge variant="outline">{copy.tagTeam}</Badge>
      {/if}
    </dd>
  </div>
</dl>
