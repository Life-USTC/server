import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";

export function youngDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return toShanghaiDateTimeLocalValue(value).replace("T", " ") || null;
}

export function youngClockTime(
  value: string | null | undefined,
): string | null {
  const time = youngDateTime(value)?.split(" ")[1];
  return time ? time.slice(0, 5) : null;
}

export function youngMonthDay(value: string | null | undefined): string | null {
  const date = youngDateTime(value)?.split(" ")[0];
  if (!date) return null;
  const [, month, day] = date.split("-");
  if (!month || !day) return null;
  return `${Number(month)}-${Number(day)}`;
}

export function youngListDayLabel(
  dateKey: string,
  locale: string,
  unknownLabel: string,
) {
  if (!dateKey) return unknownLabel;
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return unknownLabel;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function groupYoungEventsByStartDate<
  T extends { startAt: string | null },
>(events: readonly T[]) {
  const ordered = [...events].sort((left, right) =>
    (left.startAt ?? "9999").localeCompare(right.startAt ?? "9999"),
  );
  const groups: { key: string; events: T[] }[] = [];
  for (const event of ordered) {
    const key = youngDateTime(event.startAt)?.split(" ")[0] ?? "";
    const current = groups.at(-1);
    if (current?.key === key) current.events.push(event);
    else groups.push({ key, events: [event] });
  }
  return groups;
}

export function youngDateRange(
  start: string | null,
  end: string | null,
  copy: { startsAt: string; endsAt: string },
): string | null {
  const from = youngDateTime(start);
  const to = youngDateTime(end);
  if (from && to) {
    const [fromDate, fromTime] = from.split(" ");
    const [toDate, toTime] = to.split(" ");
    if (fromDate && fromDate === toDate && fromTime && toTime) {
      return `${fromDate} ${fromTime.slice(0, 5)}–${toTime.slice(0, 5)}`;
    }
    return `${from} – ${to}`;
  }
  if (from) return copy.startsAt.replace("{value}", from);
  if (to) return copy.endsAt.replace("{value}", to);
  return null;
}

/** Unknown occupancy must never look like zero registrations. */
export function youngCapacity(
  applied: number | null,
  capacity: number | null,
  unknown: string,
): string {
  if (capacity != null) return `${applied ?? unknown} / ${capacity}`;
  return applied == null ? unknown : String(applied);
}

/** Prefer upstream status text; otherwise use short open/closed badges. */
export function youngEventStatusLabel(
  event: { status: string | null; isActive: boolean },
  copy: { statusOpen: string; statusClosed: string },
): string {
  const status = event.status?.trim();
  if (status) return status;
  return event.isActive ? copy.statusOpen : copy.statusClosed;
}

/** Horizontal list metadata: keep at most `limit` chips and report overflow. */
export function youngListMetaBadges(
  values: readonly (string | null | undefined)[],
  limit = 3,
): { visible: string[]; overflow: number } {
  const unique = [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (unique.length <= limit) return { visible: unique, overflow: 0 };
  return {
    visible: unique.slice(0, limit),
    overflow: unique.length - limit,
  };
}

/** Ended rows must not claim a time is “to be announced”. */
export function youngListTimeLabel(
  startAt: string | null | undefined,
  isActive: boolean,
  copy: { unknownTime: string; unknownValue: string },
): string {
  const formatted = youngDateTime(startAt);
  if (formatted) {
    const [date, time] = formatted.split(" ");
    return time ? `${date} ${time.slice(0, 5)}` : formatted;
  }
  return isActive ? copy.unknownTime : copy.unknownValue;
}

export function youngDetailFacts(options: {
  time: string | null;
  place: string | null;
  hours: string | null;
  capacity: string | null;
  deadline: string | null;
}): string[] {
  return [
    options.time,
    options.place,
    options.hours,
    options.capacity,
    options.deadline,
  ].filter((value): value is string => Boolean(value));
}
