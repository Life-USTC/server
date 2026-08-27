import { formatCampusDateTime } from "@/lib/time/campus-date";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { intlLocale, isZhLocale } from "@/shared/lib/time-locale";

export type HomeworkDateValue = Date | string | null | undefined;

type HomeworkDescriptionValue =
  | string
  | {
      content?: string | null;
      renderedHtml?: string | null;
    }
  | null
  | undefined;

export type HomeworkDetailSource = {
  completion?: unknown | null;
  completed?: boolean;
  description?: HomeworkDescriptionValue;
  id: number | string;
  isMajor?: boolean | null;
  publishedAt?: HomeworkDateValue;
  requiresTeam?: boolean | null;
  section?: {
    code?: string | null;
    course?: {
      namePrimary?: string | null;
    } | null;
    courseName?: string | null;
    jwId?: number | null;
    semesterName?: string | null;
  } | null;
  submissionDueAt?: HomeworkDateValue;
  submissionStartAt?: HomeworkDateValue;
  title: string;
};

export type HomeworkDetailModel = {
  completed: boolean;
  contextHref: string | null;
  contextLabel: string | null;
  description: string | null;
  renderedDescriptionHtml: string | null;
  id: string;
  isMajor: boolean;
  publishedAt: HomeworkDateValue;
  requiresTeam: boolean;
  submissionDueAt: HomeworkDateValue;
  submissionStartAt: HomeworkDateValue;
  title: string;
};

export type HomeworkSummaryItem = Pick<
  HomeworkDetailModel,
  | "completed"
  | "contextHref"
  | "contextLabel"
  | "id"
  | "isMajor"
  | "requiresTeam"
  | "submissionDueAt"
  | "title"
>;

export type HomeworkSummaryBadgeVariant =
  | "default"
  | "destructive"
  | "ghost"
  | "outline"
  | "secondary";

export type HomeworkSummaryBadge = {
  key: "completed" | "major" | "team";
  label: string;
  variant: HomeworkSummaryBadgeVariant;
};

export type HomeworkDeadlineState = "overdue" | "upcoming" | "unset";

export function normalizeHomeworkDetail(
  source: HomeworkDetailSource,
  options: {
    contextHref?: string | null;
    contextLabel?: string | null;
  } = {},
): HomeworkDetailModel {
  const description = normalizeDescription(source.description);
  return {
    completed: source.completion != null || source.completed === true,
    contextHref: options.contextHref ?? null,
    contextLabel: options.contextLabel ?? null,
    description: description.content,
    renderedDescriptionHtml: description.renderedHtml,
    id: String(source.id),
    isMajor: source.isMajor === true,
    publishedAt: source.publishedAt ?? null,
    requiresTeam: source.requiresTeam === true,
    submissionDueAt: source.submissionDueAt ?? null,
    submissionStartAt: source.submissionStartAt ?? null,
    title: source.title,
  };
}

export function homeworkSummaryItem(
  source: HomeworkDetailSource,
  options: {
    contextHref?: string | null;
    contextLabel?: string | null;
  } = {},
): HomeworkSummaryItem {
  const detail = normalizeHomeworkDetail(source, options);
  return {
    completed: detail.completed,
    contextHref: detail.contextHref,
    contextLabel: detail.contextLabel,
    id: detail.id,
    isMajor: detail.isMajor,
    requiresTeam: detail.requiresTeam,
    submissionDueAt: detail.submissionDueAt,
    title: detail.title,
  };
}

export function homeworkSummaryBadges(
  homework: Pick<HomeworkSummaryItem, "completed" | "isMajor" | "requiresTeam">,
  labels: {
    completed: string;
    major: string;
    team: string;
  },
): HomeworkSummaryBadge[] {
  return [
    ...(homework.completed
      ? [
          {
            key: "completed" as const,
            label: labels.completed,
            variant: "secondary" as const,
          },
        ]
      : []),
    ...(homework.isMajor
      ? [
          {
            key: "major" as const,
            label: labels.major,
            variant: "outline" as const,
          },
        ]
      : []),
    ...(homework.requiresTeam
      ? [
          {
            key: "team" as const,
            label: labels.team,
            variant: "outline" as const,
          },
        ]
      : []),
  ];
}

export function homeworkDeadlineState(
  value: HomeworkDateValue,
  referenceValue: HomeworkDateValue = new Date(),
): HomeworkDeadlineState {
  const due = toDate(value);
  const reference = toDate(referenceValue);
  if (!due || !reference) return "unset";
  return due.getTime() <= reference.getTime() ? "overdue" : "upcoming";
}

/**
 * A numeric distance is more useful in a detail view than a bare "Overdue".
 * The unit is intentionally coarse enough to stay readable in list rows.
 */
export function formatHomeworkDueRelativeTime(
  value: HomeworkDateValue,
  referenceValue: HomeworkDateValue,
  locale: string,
  fallback: string,
) {
  const due = toDate(value);
  const reference = toDate(referenceValue);
  if (!due || !reference) return fallback;

  const deltaMinutes = Math.round(
    (due.getTime() - reference.getTime()) / 60_000,
  );
  const overdue = deltaMinutes <= 0;
  const amountMinutes = Math.abs(deltaMinutes);
  const { amount, unit } = durationUnit(amountMinutes);
  const duration = formatDuration(amount, unit, locale);

  if (isZhLocale(locale)) {
    return overdue ? `已逾期 ${duration}` : `还剩 ${duration}`;
  }
  return overdue ? `Overdue by ${duration}` : `${duration} left`;
}

export function formatHomeworkDetailDateTime(
  value: HomeworkDateValue,
  locale: string,
  fallback: string,
) {
  return formatCampusDateTime(value, fallback, locale);
}

function normalizeDescription(value: HomeworkDescriptionValue) {
  if (typeof value === "string") {
    return { content: value, renderedHtml: null };
  }
  return {
    content: value?.content ?? null,
    renderedHtml: value?.renderedHtml ?? null,
  };
}

function toDate(value: HomeworkDateValue) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string") return null;
  const parsed = parseDateInput(value);
  return parsed instanceof Date && !Number.isNaN(parsed.getTime())
    ? parsed
    : null;
}

function durationUnit(minutes: number): {
  amount: number;
  unit: "day" | "hour" | "minute" | "month" | "week";
} {
  if (minutes < 60) return { amount: Math.max(1, minutes), unit: "minute" };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { amount: Math.max(1, hours), unit: "hour" };
  const days = Math.round(hours / 24);
  if (days < 14) return { amount: Math.max(1, days), unit: "day" };
  const weeks = Math.round(days / 7);
  if (weeks < 8) return { amount: Math.max(1, weeks), unit: "week" };
  return { amount: Math.max(1, Math.round(days / 30)), unit: "month" };
}

function formatDuration(
  amount: number,
  unit: "day" | "hour" | "minute" | "month" | "week",
  locale: string,
) {
  const number = new Intl.NumberFormat(intlLocale(locale)).format(amount);
  if (isZhLocale(locale)) {
    const labels = {
      day: "天",
      hour: "小时",
      minute: "分钟",
      month: "个月",
      week: "周",
    } as const;
    return `${number}${labels[unit]}`;
  }
  const label =
    amount === 1
      ? unit
      : unit === "day"
        ? "days"
        : unit === "hour"
          ? "hours"
          : unit === "minute"
            ? "minutes"
            : unit === "month"
              ? "months"
              : "weeks";
  return `${number} ${label}`;
}

/** Keep the time math in the campus timezone for callers that pass local timestamps. */
export function homeworkDateDifferenceInMinutes(
  value: HomeworkDateValue,
  referenceValue: HomeworkDateValue,
) {
  const due = value == null ? null : shanghaiDayjs(value);
  const reference =
    referenceValue == null ? null : shanghaiDayjs(referenceValue);
  if (!due?.isValid() || !reference?.isValid()) return null;
  return due.diff(reference, "minute", true);
}
