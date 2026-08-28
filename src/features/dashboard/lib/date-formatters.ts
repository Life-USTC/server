import { formatHomeworkDueRelativeTime } from "@/features/homeworks/lib/homework-presentation";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import { formatSmartDateTime } from "@/shared/lib/time-utils";

export function formatDashboardDateTime(
  value: Date | string | null | undefined,
  fallback: string,
  referenceDate: Date | string,
  locale: string,
) {
  if (!value) return fallback;
  return formatSmartDateTime(value, new Date(referenceDate), locale);
}

export function formatDashboardDueRelativeTime(
  value: Date | string | null | undefined,
  fallback: string,
  referenceDate: Date | string,
  locale: string,
) {
  if (!value) return fallback;
  return formatHomeworkDueRelativeTime(
    value,
    new Date(referenceDate),
    locale,
    fallback,
  );
}

export function isDashboardDueOverdue(
  value: Date | string | null | undefined,
  referenceDate: Date | string,
) {
  if (!value) return false;
  return new Date(value).getTime() <= new Date(referenceDate).getTime();
}

export function dashboardDateTimeLocalValue(
  value: Date | string | null | undefined,
) {
  return toShanghaiDateTimeLocalValue(value);
}
