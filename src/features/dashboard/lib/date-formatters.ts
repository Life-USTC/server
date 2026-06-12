import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import {
  formatDueRelativeTime,
  formatSmartDateTime,
} from "@/shared/lib/time-utils";

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
  return formatDueRelativeTime(value, new Date(referenceDate), locale);
}

export function dashboardDateTimeLocalValue(
  value: Date | string | null | undefined,
) {
  return toShanghaiDateTimeLocalValue(value);
}
