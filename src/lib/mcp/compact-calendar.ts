import { isRecord } from "@/lib/is-record";
import { compactSection } from "./compact-entities";
import { asRecordArray, redactCalendarFeedLocation } from "./compact-helpers";

export function compactCalendarSubscription(value: unknown) {
  if (!isRecord(value)) return value;
  const sections =
    Object.hasOwn(value, "sections") && Array.isArray(value.sections)
      ? asRecordArray(value.sections).map(compactSection)
      : [];
  return {
    userId: value.userId,
    sectionCount: sections.length,
    sections,
    calendarPath:
      typeof value.calendarPath === "string"
        ? redactCalendarFeedLocation(value.calendarPath)
        : null,
    calendarUrl:
      typeof value.calendarUrl === "string"
        ? redactCalendarFeedLocation(value.calendarUrl)
        : null,
    note: value.note,
  };
}
