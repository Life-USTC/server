import type { PersonalCalendarItem } from "@/features/calendar/server/personal-calendar-item";
import {
  formatShanghaiDate,
  formatShanghaiTime,
} from "@/lib/time/shanghai-format";
import { compareCalendarTimelineItems } from "../lib/calendar-display-timeline";
import {
  todosDueSoonForOverview,
  todosDueTodayForOverview,
  todosOverdueForOverview,
} from "../lib/overview-filters";
import { buildOverviewStack } from "../lib/overview-stack";
import {
  buildWorkspaceAgendaDays,
  currentWorkspaceTimedEventKey,
  type WorkspaceTimelineItem,
  workspaceFocusItem,
  workspaceReferenceTime,
} from "../lib/workspace-agenda";

function timelineKey(item: PersonalCalendarItem) {
  return item.type === "schedule" ? `session-${item.id}` : item.id;
}

function timelineItem(item: PersonalCalendarItem): WorkspaceTimelineItem {
  return {
    key: timelineKey(item),
    href: item.url,
    title: item.title,
    label: item.title,
    meta: item.at && item.hasTime ? formatShanghaiTime(item.at) : "",
    detail: item.location ?? "",
    sort: item.at && item.hasTime ? workspaceReferenceTime(item.at) : 2400,
  };
}

export function buildActionableOverviewProjection(input: {
  atTime: Date;
  locale: string;
  events: PersonalCalendarItem[];
  pendingDeadlines: PersonalCalendarItem[];
}) {
  const todayKey = formatShanghaiDate(input.atTime);
  const currentTime = workspaceReferenceTime(input.atTime);
  const items = [...input.events, ...input.pendingDeadlines];
  const byKey: Record<string, PersonalCalendarItem> = Object.fromEntries(
    items.map((item) => [timelineKey(item), item]),
  );
  const eventsForDay = (_calendar: { todayDate: string }, dayKey: string) =>
    items.filter((item) => {
      if (!item.at) return false;
      const starts = formatShanghaiDate(item.at);
      if (item.type !== "young_event" || !item.endsAt) return starts === dayKey;
      return starts <= dayKey && item.endsAt > `${dayKey}T00:00:00+08:00`;
    });
  const days = buildWorkspaceAgendaDays({
    calendar: { todayDate: todayKey },
    locale: input.locale,
    startKey: todayKey,
    eventsForDay,
    timelineItemsForDay: (events) =>
      [
        ...events
          .filter((item) => item.type !== "young_event")
          .map(timelineItem)
          .sort(compareCalendarTimelineItems),
        ...events
          .filter((item) => item.type === "young_event")
          .map(timelineItem),
      ].sort((left, right) => left.sort - right.sort),
  });
  const todayEvents = eventsForDay({ todayDate: todayKey }, todayKey);
  const timed = (type: "schedule" | "exam") =>
    todayEvents
      .filter((item) => item.type === type)
      .map((item) => ({
        id: item.type === "schedule" ? item.id : item.target.id,
        startTime:
          item.at && item.hasTime ? workspaceReferenceTime(item.at) : null,
        endTime:
          item.endsAt && item.hasTime
            ? workspaceReferenceTime(item.endsAt)
            : null,
      }));
  const currentYoung = todayEvents
    .filter(
      (item) =>
        item.type === "young_event" &&
        item.at &&
        item.endsAt &&
        new Date(item.at) <= input.atTime &&
        new Date(item.endsAt) > input.atTime,
    )
    .sort(
      (a, b) =>
        (a.at ?? "").localeCompare(b.at ?? "") || a.id.localeCompare(b.id),
    )[0];
  const focus = workspaceFocusItem({
    currentEventKey:
      currentWorkspaceTimedEventKey(
        { sessions: timed("schedule"), exams: timed("exam") },
        currentTime,
      ) ?? currentYoung?.id,
    currentTime,
    days,
    todayKey,
  });
  const deadlines = input.pendingDeadlines
    .map((item) => ({ completed: false, dueAt: item.at, item }))
    .sort(
      (a, b) =>
        (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
        a.item.id.localeCompare(b.item.id),
    );
  const source = { overview: { calendar: { referenceDate: input.atTime } } };
  const stack = buildOverviewStack({
    days,
    focusKey: focus?.key,
    todayKey,
    currentTime,
    locale: input.locale,
    overdue: todosOverdueForOverview(deadlines, source).map(({ item }) => ({
      ...timelineItem(item),
      dateKey: formatShanghaiDate(item.at),
    })),
  });
  const resolve = (item: { key: string }) => byKey[item.key];
  return {
    focus: focus ? { ...resolve(focus), status: focus.status } : null,
    urgency: stack.urgency.map(resolve),
    upcoming: stack.upcoming.map(resolve),
    deadlines: {
      today: todosDueTodayForOverview(deadlines, source).map(
        ({ item }) => item,
      ),
      nextThreeDays: todosDueSoonForOverview(deadlines, source).map(
        ({ item }) => item,
      ),
      allPending: deadlines.map(({ item }) => item),
    },
  };
}
