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
  class="grid min-w-0 gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
  data-testid="homework-deadline-summary"
>
  <div class="min-w-0">
    <dt class="text-muted-foreground text-sm">{copy.submissionDue}</dt>
    <dd class="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
      {dueLabel}
    </dd>
    <dd
      class={cn(
        "mt-2 flex items-center gap-2 text-sm",
        isOverdue ? "text-destructive font-medium" : "text-muted-foreground",
      )}
    >
      <span>{copy.relativeTime}</span>
      <span aria-hidden="true">·</span>
      <span>{relativeLabel}</span>
    </dd>
  </div>

  <div class="flex min-w-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
    <dt class="text-muted-foreground text-sm">{copy.statusLabel}</dt>
    <dd>
      <Badge variant={homework.completed ? "secondary" : "outline"}>
        {homework.completed ? copy.completedLabel : copy.pendingLabel}
      </Badge>
    </dd>
  </div>
</dl>
