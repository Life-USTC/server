import type { z } from "zod";
import type { WorkspaceTimelineItem } from "@/features/workspace/lib/workspace-agenda";
import {
  type personalCalendarItemSchema,
  personalCalendarPageSchema,
} from "@/lib/api/schemas/young-workspace-schemas";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type PersonalCalendarItem = z.infer<typeof personalCalendarItemSchema>;

export class PersonalCalendarRequestError extends Error {
  constructor(readonly status: number) {
    super("Calendar request failed");
  }
}

export async function fetchPersonalCalendar(
  dateFrom: string,
  dateTo: string,
  signal: AbortSignal,
) {
  const items = new Map<string, PersonalCalendarItem>();
  let from = dateFrom;
  do {
    // Date-only bounds are inclusive. Semester grids can span more than the
    // API's 366-day limit after padding their first and last weeks.
    const windowEnd = shanghaiDayjs(from).add(365, "day").format("YYYY-MM-DD");
    const to = windowEnd < dateTo ? windowEnd : dateTo;
    let page = 1;
    while (true) {
      signal.throwIfAborted();
      const query = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        page: String(page),
        pageSize: "100",
      });
      const response = await fetch(`/api/workspace/calendar/events?${query}`, {
        signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new PersonalCalendarRequestError(response.status);
      const result = personalCalendarPageSchema.parse(await response.json());
      // An activity overlapping a window boundary appears in both responses.
      for (const item of result.data) items.set(item.id, item);
      if (page >= result.pagination.totalPages) break;
      page++;
    }
    from = shanghaiDayjs(to).add(1, "day").format("YYYY-MM-DD");
  } while (from <= dateTo);
  return [...items.values()];
}

export function personalItemsForDay(
  items: readonly PersonalCalendarItem[],
  day: string,
): WorkspaceTimelineItem[] {
  const from = shanghaiDayjs(day).startOf("day").valueOf();
  const to = from + 86400000;
  return items
    .filter((item) => {
      if (!item.at) return false;
      const start = Date.parse(item.at);
      return (
        start < to &&
        (item.endsAt ? Date.parse(item.endsAt) > from : start >= from)
      );
    })
    .map((item) => ({
      key: item.id,
      href: item.url,
      title: item.title,
      label: item.title,
      meta: [item.at, item.endsAt]
        .filter((value): value is string => Boolean(value))
        .map((value) => shanghaiDayjs(value).format("HH:mm"))
        .join("–"),
      detail: item.location ?? "",
      sort: item.at
        ? shanghaiDayjs(item.at).hour() * 100 + shanghaiDayjs(item.at).minute()
        : 2400,
      tone:
        item.type === "young_event"
          ? "success"
          : item.type === "exam"
            ? "error"
            : "info",
    }));
}
