import { isRecord } from "@/lib/utils";
import { compactBusTripSlot } from "./compact-bus";
import { compactCalendarSubscription } from "./compact-calendar";
import {
  ARRAY_KEY_COMPACTORS,
  compactArrayItem,
  KEY_COMPACTORS,
} from "./compact-dispatch";
import { compactCampus } from "./compact-entities";
import { compactEvents } from "./compact-events";
import { asRecordArray } from "./compact-helpers";

export {
  compactBusRoute,
  compactBusTrip,
  compactBusTripSlot,
} from "./compact-bus";
export { compactCalendarSubscription } from "./compact-calendar";
export {
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
// Re-export everything that external consumers need.
// Keep this file as the canonical import surface for backward compatibility.
export {
  asRecordArray,
  pick,
  redactCalendarFeedLocation,
} from "./compact-helpers";

export function compactMcpPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => compactArrayItem(item, compactMcpPayload));
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (Object.hasOwn(KEY_COMPACTORS, key)) {
      out[key] = KEY_COMPACTORS[key](fieldValue);
      continue;
    }
    if (Object.hasOwn(ARRAY_KEY_COMPACTORS, key) && Array.isArray(fieldValue)) {
      out[key] = asRecordArray(fieldValue).map(ARRAY_KEY_COMPACTORS[key]);
      continue;
    }
    if (key === "campuses" && Array.isArray(fieldValue)) {
      out.campuses = asRecordArray(fieldValue).map((c) =>
        compactCampus(c, { includeCoordinates: true }),
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
