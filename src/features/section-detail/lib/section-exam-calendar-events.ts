import type { SectionCalendarEvent } from "./calendar";
import { dateKey as buildDateKey, formatTime, timeSort } from "./date-display";
import { primaryName } from "./display";
import { calendarDetail } from "./section-calendar-detail-rows";
import type {
  ExamItem,
  SectionDetailCopy,
  SectionDetailSection,
} from "./section-calendar-event-types";

function examRoomsLabel(exam: ExamItem, sectionCopy: SectionDetailCopy) {
  const rooms = exam.examRooms
    .map((room) => room.room)
    .filter((room): room is string => Boolean(room));
  return rooms.length > 0 ? rooms.join(", ") : sectionCopy.roomTbd;
}

export function buildSectionExamCalendarEvents({
  notAvailable,
  section,
  sectionCopy,
}: {
  notAvailable: string;
  section: SectionDetailSection;
  sectionCopy: SectionDetailCopy;
}): SectionCalendarEvent[] {
  return section.exams.map((exam) => ({
    id: `exam-${exam.id}`,
    kind: "exam" as const,
    date: exam.examDate ?? null,
    dateKey: buildDateKey(exam.examDate),
    title:
      exam.examMode ?? (primaryName(section.examMode) || sectionCopy.examEvent),
    meta: `${formatTime(exam.startTime, notAvailable)}-${formatTime(exam.endTime, notAvailable)} · ${examRoomsLabel(exam, sectionCopy)}`,
    badges: [
      primaryName(exam.examBatch),
      ...exam.examRooms.map((room) => `${room.room} (${room.count})`),
    ].filter((badge): badge is string => Boolean(badge)),
    details: [
      ...calendarDetail(
        sectionCopy.examMode,
        exam.examMode ?? primaryName(section.examMode),
        notAvailable,
      ),
      ...calendarDetail(
        sectionCopy.examBatch,
        primaryName(exam.examBatch),
        notAvailable,
      ),
      ...calendarDetail(
        sectionCopy.location,
        examRoomsLabel(exam, sectionCopy),
        notAvailable,
      ),
      ...calendarDetail(
        sectionCopy.examCount,
        exam.examTakeCount,
        notAvailable,
      ),
    ],
    sortValue: timeSort(exam.startTime),
  }));
}
