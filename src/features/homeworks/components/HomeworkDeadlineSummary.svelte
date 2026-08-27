<script lang="ts">
import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
import type {
  HomeworkDateValue,
  HomeworkDeadlineState,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import { Badge } from "$lib/components/ui/badge/index.js";
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
export let relativeEtaLabel: HomeworkDetailRelativeFormatter;

$: dueLabel = fmtDate(homework.submissionDueAt) || dateFallback;
$: relativeLabel = relativeEtaLabel(homework.submissionDueAt);
$: isOverdue = deadlineState === "overdue";
$: DeadlineIcon = isOverdue ? CircleAlertIcon : CalendarClockIcon;
</script>

<section
  aria-label={copy.submissionDue}
  class="grid min-w-0 grid-cols-1 gap-5 border-y py-5 sm:grid-cols-3"
  data-testid="homework-deadline-summary"
>
  <div class="min-w-0">
    <div class="text-muted-foreground flex items-center gap-2 text-sm">
      <CalendarClockIcon aria-hidden="true" />
      <span>{copy.submissionDue}</span>
    </div>
    <p class="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl">
      {dueLabel}
    </p>
  </div>

  <div class="min-w-0">
    <div class="text-muted-foreground flex items-center gap-2 text-sm">
      <DeadlineIcon aria-hidden="true" />
      <span>{isOverdue ? relativeLabel : copy.relativeTime}</span>
    </div>
    <p class={isOverdue ? "text-destructive mt-2 text-base font-semibold" : "mt-2 text-base font-medium"}>
      {relativeLabel}
    </p>
  </div>

  <div class="flex min-w-0 items-start justify-end gap-2 sm:col-start-3 sm:row-start-1 sm:justify-start">
    <CircleCheckIcon aria-hidden="true" class="text-muted-foreground sm:mt-0.5" />
    <div class="min-w-0">
      <p class="text-muted-foreground text-sm">{copy.statusLabel}</p>
      <Badge class="mt-2" variant={homework.completed ? "secondary" : "ghost"}>
        {homework.completed ? copy.completedLabel : copy.pendingLabel}
      </Badge>
    </div>
  </div>
</section>
