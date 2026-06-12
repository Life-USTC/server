import {
  addShanghaiTime,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";

export function endOfCalendarDateWindow(windowEnd: Date) {
  return addShanghaiTime(startOfShanghaiDay(windowEnd), 1, "day");
}

export function resolveCalendarEventWindow({
  dateFrom,
  dateFromIsDateOnly,
  dateTo,
  dateToInclusive,
  dateToIsDateOnly,
}: {
  dateFrom?: Date | null;
  dateFromIsDateOnly: boolean;
  dateTo?: Date | null;
  dateToInclusive: boolean;
  dateToIsDateOnly: boolean;
}) {
  const windowStart = dateFrom
    ? dateFromIsDateOnly
      ? startOfShanghaiDay(dateFrom)
      : dateFrom
    : startOfShanghaiDay(new Date());
  const windowEnd =
    dateTo && dateToIsDateOnly
      ? addShanghaiTime(startOfShanghaiDay(dateTo), 1, "day")
      : (dateTo ?? addShanghaiTime(windowStart, 7, "day"));
  const includeWindowEnd = Boolean(
    dateTo && dateToInclusive && !dateToIsDateOnly,
  );

  return {
    calendarDateStart: startOfShanghaiDay(windowStart),
    calendarDateEnd: endOfCalendarDateWindow(windowEnd),
    includeWindowEnd,
    windowEnd,
    windowStart,
  };
}

export function isWithinExactWindow(
  {
    start,
    end,
  }: {
    start: Date | null;
    end?: Date | null;
  },
  windowStart: Date,
  windowEnd: Date,
  includeWindowEnd: boolean,
  mode: "overlap" | "start",
) {
  if (!start) return false;

  const startTime = start.getTime();
  if (Number.isNaN(startTime)) return false;

  if (mode === "overlap" && end) {
    const endTime = end.getTime();
    if (Number.isNaN(endTime)) return false;
    return (
      endTime > windowStart.getTime() &&
      (includeWindowEnd
        ? startTime <= windowEnd.getTime()
        : startTime < windowEnd.getTime())
    );
  }

  return (
    startTime >= windowStart.getTime() &&
    (includeWindowEnd
      ? startTime <= windowEnd.getTime()
      : startTime < windowEnd.getTime())
  );
}
