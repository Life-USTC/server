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
  const items: PersonalCalendarItem[] = [];
  let page = 1;
  while (true) {
    const query = new URLSearchParams({
      dateFrom,
      dateTo,
      page: String(page),
      pageSize: "100",
    });
    const response = await fetch(`/api/workspace/calendar/events?${query}`, {
      signal,
    });
    if (!response.ok) throw new PersonalCalendarRequestError(response.status);
    const result = personalCalendarPageSchema.parse(await response.json());
    items.push(...result.data);
    if (page >= result.pagination.totalPages) return items;
    page++;
  }
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
      meta: item.at ? shanghaiDayjs(item.at).format("HH:mm") : "",
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
