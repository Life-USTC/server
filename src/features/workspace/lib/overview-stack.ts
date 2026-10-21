import { formatCampusDate } from "@/lib/time/campus-date";
import type {
  WorkspaceAgendaDay,
  WorkspaceTimelineItem,
} from "./workspace-agenda";

export type OverviewStackItem = WorkspaceTimelineItem & {
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string;
};

export function buildOverviewStack(input: {
  days: WorkspaceAgendaDay[];
  overdue: Array<WorkspaceTimelineItem & { dateKey: string }>;
  focusKey?: string;
  todayKey: string;
  currentTime: number;
  locale: string;
}) {
  const seen = new Set(input.focusKey ? [input.focusKey] : []);
  const urgency: OverviewStackItem[] = [];
  const upcoming: OverviewStackItem[] = [];
  const overdue = input.overdue.map((item) => ({
    ...item,
    dateLabel: formatCampusDate(item.dateKey, input.todayKey, input.locale, {
      day: "numeric",
      month: "short",
    }),
    weekdayLabel: formatCampusDate(item.dateKey, input.todayKey, input.locale, {
      weekday: "long",
    }),
  }));
  const dated = input.days.flatMap((day) =>
    day.events.map((event) => ({
      ...event,
      dateKey: day.key,
      dateLabel: day.dateLabel,
      weekdayLabel: day.weekdayLabel,
    })),
  );
  for (const item of [...overdue, ...dated].sort(
    (left, right) =>
      left.dateKey.localeCompare(right.dateKey) ||
      left.sort - right.sort ||
      left.key.localeCompare(right.key),
  )) {
    if (item.done || seen.has(item.key)) continue;
    const deadline =
      item.key.startsWith("homework-") || item.key.startsWith("todo-");
    if (deadline && item.dateKey <= input.todayKey) {
      urgency.push(item);
    } else if (
      item.dateKey > input.todayKey ||
      (item.dateKey === input.todayKey && item.sort >= input.currentTime)
    ) {
      upcoming.push(item);
    } else continue;
    seen.add(item.key);
  }
  return { urgency, upcoming };
}
