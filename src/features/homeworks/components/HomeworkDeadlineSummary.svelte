<script lang="ts">
import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import CircleIcon from "@lucide/svelte/icons/circle";
import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
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
export let referenceDate: HomeworkDateValue;
export let relativeEtaLabel: HomeworkDetailRelativeFormatter;

$: dueLabel = fmtDate(homework.submissionDueAt) || dateFallback;
$: relativeLabel = relativeEtaLabel(homework.submissionDueAt, referenceDate);
$: isOverdue = deadlineState === "overdue";
$: DeadlineIcon = isOverdue ? CircleAlertIcon : CalendarClockIcon;
$: StatusIcon = homework.completed ? CheckCircleIcon : CircleIcon;
</script>

<dl
  aria-label={copy.submissionDue}
  class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-5 sm:grid-cols-3"
  data-testid="homework-deadline-summary"
>
  <div class="min-w-0">
    <dt class="text-muted-foreground flex items-center gap-2 text-sm">
      <CalendarClockIcon aria-hidden="true" />
      <span>{copy.submissionDue}</span>
    </dt>
    <dd class="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl">
      {dueLabel}
    </dd>
  </div>

  <div class="col-span-2 min-w-0 sm:col-span-1">
    <dt class="text-muted-foreground flex items-center gap-2 text-sm">
      <DeadlineIcon aria-hidden="true" />
      <span>{copy.relativeTime}</span>
    </dt>
    <dd class={isOverdue ? "text-destructive mt-2 text-base font-semibold" : "mt-2 text-base font-medium"}>
      {relativeLabel}
    </dd>
  </div>

  <div class="col-start-2 row-start-1 flex min-w-0 items-start justify-end gap-2 sm:col-start-3 sm:justify-start">
    <StatusIcon aria-hidden="true" class="text-muted-foreground sm:mt-0.5" />
    <div class="min-w-0">
      <dt class="text-muted-foreground text-sm">{copy.statusLabel}</dt>
      <dd class="mt-2">
        <Badge variant={homework.completed ? "secondary" : "ghost"}>
        {homework.completed ? copy.completedLabel : copy.pendingLabel}
        </Badge>
      </dd>
    </div>
  </div>
</dl>
