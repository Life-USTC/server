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
