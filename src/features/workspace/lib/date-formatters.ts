import { formatHomeworkDueRelativeTime } from "@/features/homeworks/lib/homework-presentation";
import { formatSmartDateTime } from "@/shared/lib/time-utils";

type Deadline = Date | string | null | undefined;

export function isWorkspaceDueOverdue(
  value: Deadline,
  reference: Date | string,
) {
  return Boolean(
    value && new Date(value).getTime() <= new Date(reference).getTime(),
  );
}

export function workspaceDeadlineLabels(
  reference: Date | string,
  locale: string,
  fallback: string,
) {
  const now = new Date(reference);
  return {
    fmtDate: (value: Deadline) =>
      value ? formatSmartDateTime(value, now, locale) : fallback,
    relativeDueLabel: (value: Deadline) =>
      formatHomeworkDueRelativeTime(value, now, locale, fallback),
    isDueOverdue: (value: Deadline) => isWorkspaceDueOverdue(value, now),
  };
}
