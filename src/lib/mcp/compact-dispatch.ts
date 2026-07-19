import { isRecord } from "@/lib/is-record";
import {
  compactBusRoute,
  compactBusTrip,
  compactBusTripSlot,
  compactCalendarSubscription,
  compactCampus,
  compactCourse,
  compactDepartment,
  compactExam,
  compactHomework,
  compactSchedule,
  compactSection,
  compactSemester,
  compactTeacher,
  compactTeacherTitle,
  compactTodo,
  compactUser,
} from "./compact-entities";
import {
  asRecordArray,
  pick,
  redactCalendarFeedLocation,
} from "./compact-helpers";

type CompactArrayMatch = { matched: true; value: unknown } | { matched: false };

export function compactBusArrayItem(
  value: Record<string, unknown>,
): CompactArrayMatch {
  if (
    Object.hasOwn(value, "routeId") &&
    (value.dayType === "weekday" || value.dayType === "weekend") &&
    Object.hasOwn(value, "stopTimes") &&
    Array.isArray(value.stopTimes)
  ) {
    return { matched: true, value: compactBusTrip(value) };
  }

  if (
    Object.hasOwn(value, "position") &&
    Array.isArray(value.stopTimes) &&
    !Object.hasOwn(value, "routeId") &&
    !Object.hasOwn(value, "dayType")
  ) {
    return { matched: true, value: compactBusTripSlot(value) };
  }

  if (
    Object.hasOwn(value, "stops") &&
    Array.isArray(value.stops) &&
    Object.hasOwn(value, "routeId") &&
    typeof value.routeId === "string" &&
    !Object.hasOwn(value, "dayType")
  ) {
    return { matched: true, value: compactBusRoute(value) };
  }

  return { matched: false };
}

export function compactEntityArrayItem(
  value: Record<string, unknown>,
): CompactArrayMatch {
  if (
    Object.hasOwn(value, "latitude") &&
    Object.hasOwn(value, "longitude") &&
    !Object.hasOwn(value, "stops")
  ) {
    return {
      matched: true,
      value: compactCampus(value, { includeCoordinates: true }),
    };
  }

  if (
    Object.hasOwn(value, "teacherId") ||
    Object.hasOwn(value, "personId") ||
    Object.hasOwn(value, "teacherTitleId") ||
    Object.hasOwn(value, "departmentId")
  ) {
    return { matched: true, value: compactTeacher(value) };
  }

  if (Object.hasOwn(value, "completed") && Object.hasOwn(value, "priority")) {
    return { matched: true, value: compactTodo(value) };
  }

  if (
    Object.hasOwn(value, "submissionDueAt") &&
    (Object.hasOwn(value, "sectionId") ||
      Object.hasOwn(value, "isMajor") ||
      Object.hasOwn(value, "requiresTeam"))
  ) {
    return { matched: true, value: compactHomework(value) };
  }

  if (
    (Object.hasOwn(value, "examDate") ||
      Object.hasOwn(value, "examBatch") ||
      Object.hasOwn(value, "examRooms")) &&
    Object.hasOwn(value, "sectionId")
  ) {
    return { matched: true, value: compactExam(value) };
  }

  if (
    Object.hasOwn(value, "date") &&
    Object.hasOwn(value, "weekday") &&
    Object.hasOwn(value, "startTime") &&
    Object.hasOwn(value, "endTime")
  ) {
    return { matched: true, value: compactSchedule(value) };
  }

  if (
    Object.hasOwn(value, "campusId") ||
    Object.hasOwn(value, "openDepartmentId") ||
    (Object.hasOwn(value, "course") && Object.hasOwn(value, "semester"))
  ) {
    return { matched: true, value: compactSection(value) };
  }

  if (
    Object.hasOwn(value, "credit") ||
    Object.hasOwn(value, "hours") ||
    Object.hasOwn(value, "educationLevelId")
  ) {
    return { matched: true, value: compactCourse(value) };
  }

  if (
    Object.hasOwn(value, "nameCn") &&
    Object.hasOwn(value, "code") &&
    (Object.hasOwn(value, "startDate") || Object.hasOwn(value, "endDate")) &&
    !Object.hasOwn(value, "campusId")
  ) {
    return { matched: true, value: compactSemester(value) };
  }

  return { matched: false };
}

export function compactArrayItem(
  value: unknown,
  compactMcpPayload: (value: unknown) => unknown,
): unknown {
  if (!isRecord(value)) return compactMcpPayload(value);

  if (
    Object.hasOwn(value, "sections") &&
    (Object.hasOwn(value, "calendarPath") ||
      Object.hasOwn(value, "calendarUrl"))
  ) {
    return compactCalendarSubscription(value);
  }

  const busItem = compactBusArrayItem(value);
  if (busItem.matched) return busItem.value;

  const entityItem = compactEntityArrayItem(value);
  if (entityItem.matched) return entityItem.value;

  return compactMcpPayload(value);
}

export const KEY_COMPACTORS: Record<string, (v: unknown) => unknown> = {
  calendarPath: (v) =>
    typeof v === "string" ? redactCalendarFeedLocation(v) : v,
  calendarUrl: (v) =>
    typeof v === "string" ? redactCalendarFeedLocation(v) : v,
  user: compactUser,
  course: compactCourse,
  semester: compactSemester,
  campus: compactCampus,
  openDepartment: compactDepartment,
  department: compactDepartment,
  teacherTitle: compactTeacherTitle,
  teacher: compactTeacher,
  todo: compactTodo,
  homework: compactHomework,
  schedule: compactSchedule,
  exam: compactExam,
  section: compactSection,
};

export const ARRAY_KEY_COMPACTORS: Record<string, (v: unknown) => unknown> = {
  todos: compactTodo,
  courses: compactCourse,
  sections: compactSection,
  teachers: compactTeacher,
  homeworks: compactHomework,
  schedules: compactSchedule,
  exams: compactExam,
  routes: compactBusRoute,
  trips: compactBusTrip,
  subscriptions: compactCalendarSubscription,
};

export const EVENT_PAYLOAD_COMPACTORS: Record<string, (v: unknown) => unknown> =
  {
    schedule: compactSchedule,
    homework_due: compactHomework,
    exam: compactExam,
    todo_due: compactTodo,
  };

const COMPACT_OMITTED_KEYS = new Set(["renderedBody", "renderedHtml"]);

export function compactEvents(
  value: unknown[],
  fallbackCompact: (value: unknown) => unknown,
) {
  return asRecordArray(value).map((event) => {
    const base = pick(event, ["type", "at"]);
    if (!Object.hasOwn(event, "payload")) return base;
    const compactFn =
      isRecord(event) && typeof event.type === "string"
        ? EVENT_PAYLOAD_COMPACTORS[event.type]
        : undefined;
    return {
      ...base,
      payload: (compactFn ?? fallbackCompact)(event.payload),
    };
  });
}

export function compactMcpPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => compactArrayItem(item, compactMcpPayload));
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (COMPACT_OMITTED_KEYS.has(key)) {
      continue;
    }
    if (Object.hasOwn(KEY_COMPACTORS, key)) {
      out[key] = KEY_COMPACTORS[key](fieldValue);
      continue;
    }
    if (Object.hasOwn(ARRAY_KEY_COMPACTORS, key) && Array.isArray(fieldValue)) {
      out[key] = asRecordArray(fieldValue).map(ARRAY_KEY_COMPACTORS[key]);
      continue;
    }
    if (key === "campuses" && Array.isArray(fieldValue)) {
      out.campuses = asRecordArray(fieldValue).map((campus) =>
        compactCampus(campus, { includeCoordinates: true }),
      );
      continue;
    }
    if ((key === "weekday" || key === "weekend") && Array.isArray(fieldValue)) {
      out[key] = asRecordArray(fieldValue).map(compactBusTripSlot);
      continue;
    }
    if (key === "subscription") {
      out.subscription =
        isRecord(fieldValue) &&
        Object.hasOwn(fieldValue, "sections") &&
        (Object.hasOwn(fieldValue, "calendarPath") ||
          Object.hasOwn(fieldValue, "calendarUrl"))
          ? compactCalendarSubscription(fieldValue)
          : compactMcpPayload(fieldValue);
      continue;
    }
    if (key === "events" && Array.isArray(fieldValue)) {
      out.events = compactEvents(fieldValue, compactMcpPayload);
      continue;
    }
    out[key] = compactMcpPayload(fieldValue);
  }

  return out;
}
