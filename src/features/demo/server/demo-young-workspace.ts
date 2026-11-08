import { personalCalendarItem } from "@/features/calendar/server/personal-calendar-item";
import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import type { youngNotificationSchema } from "@/lib/api/schemas/young-workspace-schemas";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginationInput,
} from "@/lib/pagination";
import {
  getDemoYoungEvents,
  getDemoYoungOrganizers,
  getDemoYoungSubscriptionFacts,
} from "./demo-young";

const subscribedAt = "2026-09-22T08:00:00+08:00";
const newestFirst = <T extends { createdAt: string }>(
  rows: T[],
  id: (row: T) => string,
) =>
  rows.sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      id(a).localeCompare(id(b)),
  );
function eventRows(locale: AppLocale) {
  return newestFirst(
    getDemoYoungEvents(locale, { pageSize: 100 }).data.flatMap((event) => {
      const facts = getDemoYoungSubscriptionFacts("events", event.youngId);
      return facts?.subscribed
        ? [
            {
              youngId: event.youngId,
              createdAt: subscribedAt,
              remindSignup: facts.remindSignup ?? false,
              remindDeadline: facts.remindDeadline ?? false,
              remindStart: facts.remindStart ?? false,
              event,
            },
          ]
        : [];
    }),
    (row) => row.youngId,
  );
}
function organizerRows(locale: AppLocale) {
  return newestFirst(
    getDemoYoungOrganizers(locale, { pageSize: 100 })
      .data.filter(
        (row) =>
          getDemoYoungSubscriptionFacts("organizers", row.id)?.subscribed,
      )
      .map((row) => ({
        organizerId: row.id,
        createdAt: subscribedAt,
        organizer: { id: row.id, name: row.name },
      })),
    (row) => row.organizerId,
  );
}
function paginate<T>(rows: T[], input: PaginationInput) {
  const { page, pageSize, skip } = normalizePagination(input);
  return buildPaginatedResponse(
    rows.slice(skip, skip + pageSize),
    page,
    pageSize,
    rows.length,
  );
}
export function getDemoYoungEventSubscriptions(
  locale: AppLocale,
  input: PaginationInput = {},
) {
  return paginate(eventRows(locale), input);
}
export function getDemoYoungOrganizerSubscriptions(
  locale: AppLocale,
  input: PaginationInput = {},
) {
  return paginate(organizerRows(locale), input);
}

/** Persisted fictional examples at the published clock, not a refresh or delivery claim. */
function notifications(
  locale: AppLocale,
): ReturnType<typeof youngNotificationSchema.parse>[] {
  const events = eventRows(locale),
    reminder = events.find((row) => row.youngId === "demo-young-28");
  if (!reminder) throw new Error("Missing fictional reminder event");
  const changed = events
    .filter(
      (row) =>
        row.youngId !== "demo-young-28" && row.youngId !== "demo-young-42",
    )
    .map((row, index) => ({
      id: `demo-young-notification-change-${String(index + 1).padStart(2, "0")}`,
      youngId: row.youngId,
      organizerId: null as string | null,
      kind: "event_changed",
      title: row.event.name,
      body: row.event.sourceMissing
        ? "来源暂缺，请核实校方信息 / Source unavailable; check the official event page."
        : "活动信息有更新，请查看最新时间、地点和报名状态 / Event details changed; check the latest time, venue and registration status.",
      createdAt: `2026-09-24T08:${String(index + 10).padStart(2, "0")}:00+08:00`,
      readAt: index < 2 ? "2026-09-24T08:45:00+08:00" : null,
      expiresAt: null as string | null,
    }));
  const reminders = [
    {
      kind: "signup_open",
      body: "报名已开始 / Registration opened",
      createdAt: "2026-09-24T08:00:00+08:00",
      expiresAt: reminder.event.applyEndAt,
    },
    {
      kind: "signup_deadline",
      body: "报名即将截止 / Registration closes soon",
      createdAt: "2026-09-24T08:00:00+08:00",
      expiresAt: reminder.event.applyEndAt,
    },
    {
      kind: "event_start",
      body: "活动即将开始 / Event starts soon",
      createdAt: "2026-09-24T08:30:00+08:00",
      expiresAt: reminder.event.startAt,
    },
  ].map((row) => ({
    ...row,
    id: `demo-young-notification-${row.kind}`,
    youngId: reminder.youngId,
    organizerId: null,
    title: reminder.event.name,
    readAt: null,
  }));
  const organizer = organizerRows(locale).find(
    (row) => row.organizerId === "demo-young-organizer-7",
  );
  if (!organizer) throw new Error("Missing fictional digest organizer");
  return [
    ...changed,
    ...reminders,
    {
      id: "demo-young-notification-digest",
      youngId: null,
      organizerId: organizer.organizerId,
      kind: "organizer_digest",
      title: organizer.organizer.name,
      body: `1 个新活动 / new events: ${reminder.event.name}`,
      createdAt: "2026-09-24T00:00:00+08:00",
      readAt: null,
      expiresAt: null,
    },
  ]
    .filter(
      (row) =>
        row.expiresAt === null ||
        Date.parse(row.expiresAt) > Date.parse(DEMO_REFERENCE_NOW),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id.localeCompare(a.id),
    );
}
export function getDemoYoungNotifications(
  locale: AppLocale,
  input: PaginationInput & { unread?: boolean } = {},
) {
  return paginate(
    notifications(locale).filter((row) => !input.unread || row.readAt === null),
    input,
  );
}
export function getDemoUnreadYoungNotificationsCount() {
  return notifications("zh-cn").filter((row) => row.readAt === null).length;
}
export function getDemoSubscribedYoungCalendarItems(locale: AppLocale) {
  return eventRows(locale).map(({ event }) =>
    personalCalendarItem(
      {
        type: "young_event",
        at: event.startAt,
        endsAt: event.endAt,
        conflictIntervals: event.conflictIntervals ?? [],
        payload: event,
      },
      new Map(),
      locale,
    ),
  );
}
