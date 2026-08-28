<script lang="ts">
import type {
  HomeworkDateValue,
  HomeworkDeadlineState,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
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

<div class="min-w-0" data-testid="homework-deadline-summary">
  <p class="text-muted-foreground text-sm">{copy.submissionDue}</p>
  <p class="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
    {dueLabel}
  </p>
  {#if homework.submissionDueAt && relativeLabel}
    <p
      aria-label={copy.relativeTime}
      class={cn(
        "mt-1 text-sm",
        isOverdue ? "text-destructive font-medium" : "text-muted-foreground",
      )}
    >
      {relativeLabel}
    </p>
  {/if}
</div>
