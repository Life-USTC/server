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
  class="grid min-w-0 gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-5"
  data-testid="homework-deadline-summary"
>
  <div class="min-w-0">
    <dt class="text-muted-foreground flex items-center gap-2 text-sm">
      <CalendarClockIcon aria-hidden="true" class="size-4 shrink-0" />
      <span>{copy.submissionDue}</span>
    </dt>
    <dd class="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
      {dueLabel}
    </dd>
    <dd
      class={isOverdue
        ? "text-destructive mt-2 flex items-center gap-2 text-sm font-medium"
        : "text-muted-foreground mt-2 flex items-center gap-2 text-sm"}
    >
      <DeadlineIcon aria-hidden="true" class="size-4 shrink-0" />
      <span>{copy.relativeTime}</span>
      <span aria-hidden="true">·</span>
      <span>{relativeLabel}</span>
    </dd>
  </div>

  <div class="flex min-w-0 items-center gap-2 sm:justify-end">
    <StatusIcon aria-hidden="true" class="text-muted-foreground size-4 shrink-0" />
    <div class="min-w-0">
      <dt class="text-muted-foreground text-sm">{copy.statusLabel}</dt>
      <dd class="mt-1">
        <Badge variant={homework.completed ? "secondary" : "outline"}>
          {homework.completed ? copy.completedLabel : copy.pendingLabel}
        </Badge>
      </dd>
    </div>
  </div>
</dl>
