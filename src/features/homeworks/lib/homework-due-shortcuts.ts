import { toDateTimeFromHHmm } from "@/lib/time/date-time-from-hhmm";
import { APP_TIME_ZONE, parseDateInput } from "@/lib/time/parse-date-input";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import { getWeekStart } from "@/shared/lib/date-utils";
import { intlLocale, isZhLocale } from "@/shared/lib/time-locale";

export type HomeworkDueShortcut = {
  label: string;
  value: string;
};

export type HomeworkDueShortcutCopy = {
  helperBeforeMonday: string;
  helperNextClass: string;
  helperNextWeek: string;
  helperThisWeek: string;
};

type DateLike = Date | string;

type ActualClassSchedule = {
  date: DateLike | null | undefined;
  startTime: number | string | null | undefined;
};

type DueShortcutInput = {
  classStarts?: readonly DateLike[];
  copy: HomeworkDueShortcutCopy;
  locale: string;
  now?: DateLike;
};

const NEXT_CLASS_LIMIT = 3;

function parseDateLike(value: DateLike | null | undefined) {
  const parsed = value instanceof Date ? value : parseDateInput(value);
  return parsed instanceof Date && Number.isFinite(parsed.getTime())
    ? parsed
    : null;
}

function formatTemplate(
  template: string,
  values: { date: string; weekday?: string },
) {
  return template.replace(
    /\{(date|weekday)\}/g,
    (_match, key: string) => values[key as keyof typeof values] ?? "",
  );
}

function formatShortcutDate(value: Date, locale: string) {
  const date = shanghaiDayjs(value);
  if (isZhLocale(locale)) {
    return `${date.year()}年${date.month() + 1}月${date.date()}日 ${date.format("HH:mm")}`;
  }
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).format(value);
}

function formatShortcutWeekday(value: Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).format(value);
}

function uniqueFutureDates(
  values: readonly DateLike[],
  now: Date,
  limit?: number,
) {
  const seen = new Set<number>();
  const dates = values
    .map(parseDateLike)
    .filter((value): value is Date => value !== null)
    .filter((value) => value.getTime() > now.getTime())
    .sort((left, right) => left.getTime() - right.getTime())
    .filter((value) => {
      const timestamp = value.getTime();
      if (seen.has(timestamp)) return false;
      seen.add(timestamp);
      return true;
    });

  return limit === undefined ? dates : dates.slice(0, limit);
}

/**
 * Resolve the next actual schedule starts from dates already stored by the
 * static loader. A schedule without a concrete date is intentionally ignored;
 * this helper never derives a weekly recurrence from weekday metadata.
 */
export function nextHomeworkClassStarts(
  schedules: readonly ActualClassSchedule[],
  now: DateLike = new Date(),
) {
  const reference = parseDateLike(now);
  if (!reference) return [];

  const starts = schedules.flatMap((schedule) => {
    const date = parseDateLike(schedule.date);
    const startTime =
      typeof schedule.startTime === "number"
        ? schedule.startTime
        : schedule.startTime === null || schedule.startTime === undefined
          ? null
          : Number(schedule.startTime);
    if (!date || startTime === null || !Number.isFinite(startTime)) return [];

    try {
      const start = toDateTimeFromHHmm(date, startTime);
      return start ? [start] : [];
    } catch {
      return [];
    }
  });

  return uniqueFutureDates(starts, reference, NEXT_CLASS_LIMIT).map((date) =>
    toShanghaiIsoString(date),
  );
}

function weeklyDeadlineCandidates(now: Date) {
  const reference = shanghaiDayjs(now);
  const thisWeek = getWeekStart(reference);
  const weekdays = [4, 5, 6] as const;
  const candidates = [
    ...weekdays.map((weekday) => ({
      date: thisWeek
        .add(weekday, "day")
        .hour(23)
        .minute(59)
        .second(0)
        .millisecond(0),
      period: "this" as const,
    })),
    {
      date: thisWeek.add(7, "day").startOf("day"),
      period: "beforeMonday" as const,
    },
    ...weekdays.map((weekday) => ({
      date: thisWeek
        .add(7 + weekday, "day")
        .hour(23)
        .minute(59)
        .second(0)
        .millisecond(0),
      period: "next" as const,
    })),
    {
      date: thisWeek.add(14, "day").startOf("day"),
      period: "beforeMonday" as const,
    },
  ];

  return candidates.filter((candidate) => candidate.date.isAfter(reference));
}

function shortcutValue(value: Date) {
  return toShanghaiDateTimeLocalValue(value);
}

/**
 * Build bounded, localized due-date suggestions for a homework form.
 * Returned values are datetime-local strings in the app's Shanghai timezone.
 */
export function buildHomeworkDueShortcuts({
  classStarts = [],
  copy,
  locale,
  now = new Date(),
}: DueShortcutInput): HomeworkDueShortcut[] {
  const reference = parseDateLike(now);
  if (!reference) return [];

  const classDates = uniqueFutureDates(
    classStarts,
    reference,
    NEXT_CLASS_LIMIT,
  );
  const seen = new Set(classDates.map((date) => date.getTime()));
  const shortcuts = classDates.map((date) => ({
    label: formatTemplate(copy.helperNextClass, {
      date: formatShortcutDate(date, locale),
    }),
    value: shortcutValue(date),
  }));

  for (const candidate of weeklyDeadlineCandidates(reference)) {
    const date = candidate.date.toDate();
    const timestamp = date.getTime();
    if (seen.has(timestamp)) continue;
    seen.add(timestamp);

    const formatted = {
      date: formatShortcutDate(date, locale),
      weekday: formatShortcutWeekday(date, locale),
    };
    shortcuts.push({
      label: formatTemplate(
        candidate.period === "this"
          ? copy.helperThisWeek
          : candidate.period === "next"
            ? copy.helperNextWeek
            : copy.helperBeforeMonday,
        formatted,
      ),
      value: shortcutValue(date),
    });
  }

  return shortcuts;
}
