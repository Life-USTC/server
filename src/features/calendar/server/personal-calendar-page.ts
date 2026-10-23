import { getUserSubscriptionKinds } from "@/features/subscriptions/server/subscription-kind";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import { personalCalendarItem } from "./personal-calendar-item";
import { parsePersonalCalendarRange } from "./personal-calendar-range";

export { InvalidCalendarRangeError } from "./personal-calendar-range";

import { listUserCalendarEvents } from "./calendar-events";

export async function listPersonalCalendarPage(
  userId: string,
  input: PaginationInput & {
    dateFrom?: string;
    dateTo?: string;
    locale?: string;
  } = {},
) {
  const range = parsePersonalCalendarRange(input);
  const [events, kinds] = await Promise.all([
    listUserCalendarEvents(userId, {
      ...range,
      locale: input.locale,
      sectionContext: "compact",
    }),
    getUserSubscriptionKinds(userId),
  ]);
  const items = events.map((event) =>
    personalCalendarItem(event, kinds, input.locale),
  );
  const { page, pageSize, skip } = normalizePagination(input);
  return buildPaginatedResponse(
    items.slice(skip, skip + pageSize),
    page,
    pageSize,
    items.length,
  );
}
