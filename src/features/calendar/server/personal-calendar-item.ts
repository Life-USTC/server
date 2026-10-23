import type { SubscriptionKind } from "@/features/subscriptions/lib/subscription-kind";
import type { TodoPriority } from "@/generated/prisma/client";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import type { listUserCalendarEvents } from "./calendar-events";

export type PersonalCalendarItem = {
  id: string;
  type: "schedule" | "exam" | "homework_due" | "todo_due" | "young_event";
  at: string | null;
  endsAt: string | null;
  title: string;
  location: string | null;
  url: string;
  youngId: string | null;
  target: {
    kind: "section" | "exam" | "homework" | "todo" | "young_event";
    id: string;
  };
  sectionJwId: number | null;
  sectionCode: string | null;
  teachers: string[];
  subscriptionKind: SubscriptionKind | null;
  priority: TodoPriority | null;
  content: string | null;
  examMode: string | null;
  hasTime: boolean;
  completionRequired: boolean | null;
};

type CalendarEvent = Awaited<ReturnType<typeof listUserCalendarEvents>>[number];
type SubscriptionKinds = ReadonlyMap<number, SubscriptionKind>;

function emptyContext() {
  return {
    youngId: null,
    sectionJwId: null,
    sectionCode: null,
    teachers: [],
    subscriptionKind: null,
    priority: null,
    content: null,
    examMode: null,
    hasTime: true,
    completionRequired: null,
  };
}

export function homeworkCalendarItem(
  homework: {
    id: string;
    title: string;
    submissionDueAt: Date | null;
    description?: { content: string } | null;
    sectionId: number;
    section: { jwId: number; code: string } | null;
    completionRequired?: boolean;
  },
  kinds: SubscriptionKinds,
): PersonalCalendarItem {
  return {
    ...emptyContext(),
    id: `homework-${homework.id}`,
    type: "homework_due",
    title: homework.title,
    at: homework.submissionDueAt
      ? toShanghaiIsoString(homework.submissionDueAt)
      : null,
    endsAt: null,
    location: null,
    url: "/workspace/homeworks",
    target: { kind: "homework", id: homework.id },
    sectionJwId: homework.section?.jwId ?? null,
    sectionCode: homework.section?.code ?? null,
    subscriptionKind: kinds.get(homework.sectionId) ?? null,
    content: homework.description?.content ?? null,
    hasTime: homework.submissionDueAt !== null,
    completionRequired: homework.completionRequired ?? true,
  };
}

export function todoCalendarItem(todo: {
  id: string;
  title: string;
  dueAt: Date | null;
  content: string | null;
  priority: TodoPriority;
}): PersonalCalendarItem {
  return {
    ...emptyContext(),
    id: `todo-${todo.id}`,
    type: "todo_due",
    title: todo.title,
    at: todo.dueAt ? toShanghaiIsoString(todo.dueAt) : null,
    endsAt: null,
    location: null,
    url: "/workspace/todos",
    target: { kind: "todo", id: todo.id },
    content: todo.content,
    priority: todo.priority,
    hasTime: todo.dueAt !== null,
  };
}

export function personalCalendarItem(
  event: CalendarEvent,
  kinds: SubscriptionKinds,
): PersonalCalendarItem {
  const base = {
    ...emptyContext(),
    type: event.type,
    at: event.at,
    endsAt: event.endsAt,
  };
  switch (event.type) {
    case "young_event":
      return {
        ...base,
        id: `young-${event.payload.youngId}`,
        youngId: event.payload.youngId,
        title: event.payload.name,
        location: event.payload.location,
        url: `/catalog/young-events/${encodeURIComponent(event.payload.youngId)}`,
        target: { kind: "young_event", id: event.payload.youngId },
        hasTime: event.at !== null,
      };
    case "todo_due":
      return todoCalendarItem(event.payload);
    case "homework_due":
      return homeworkCalendarItem(event.payload, kinds);
    case "schedule":
      return {
        ...base,
        id: `schedule-${event.payload.id}-${event.at}`,
        title: event.payload.section.course.nameCn,
        location:
          event.payload.customPlace?.trim() ||
          event.payload.room?.nameCn ||
          null,
        url: `/catalog/sections/${event.payload.section.jwId}`,
        target: { kind: "section", id: String(event.payload.section.jwId) },
        sectionJwId: event.payload.section.jwId,
        sectionCode: event.payload.section.code,
        teachers: event.payload.teacherParticipations.map(
          ({ teacher }) => teacher.nameCn,
        ),
        subscriptionKind: kinds.get(event.payload.sectionId) ?? null,
        hasTime: event.payload.startTime !== null,
      };
    case "exam":
      return {
        ...base,
        id: `exam-${event.payload.id}`,
        title: event.payload.section.course.nameCn,
        location:
          event.payload.examRooms
            .map((room) => room.room)
            .filter(Boolean)
            .join(" · ") || null,
        url: "/workspace/exams",
        target: { kind: "exam", id: String(event.payload.id) },
        sectionJwId: event.payload.section.jwId,
        sectionCode: event.payload.section.code,
        subscriptionKind: kinds.get(event.payload.sectionId) ?? null,
        examMode: event.payload.examMode,
        hasTime: event.payload.startTime !== null,
      };
  }
  throw new Error("Unsupported calendar event type");
}
