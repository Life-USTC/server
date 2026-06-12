import type { SectionCalendarEvent } from "./calendar";
import { buildSectionClassCalendarEvents } from "./section-class-calendar-events";
import type { SectionDetailPageData } from "./section-detail-controller-helpers";
import { buildSectionExamCalendarEvents } from "./section-exam-calendar-events";

type SectionDetailCopy = SectionDetailPageData["copy"]["sectionDetail"];
type SectionDetailSection = SectionDetailPageData["section"];

export function buildSectionDetailCalendarEvents({
  notAvailable,
  section,
  sectionCopy,
}: {
  notAvailable: string;
  section: SectionDetailSection;
  sectionCopy: SectionDetailCopy;
}): SectionCalendarEvent[] {
  const classEvents = buildSectionClassCalendarEvents({
    notAvailable,
    section,
    sectionCopy,
  });
  const examEvents = buildSectionExamCalendarEvents({
    notAvailable,
    section,
    sectionCopy,
  });

  return [...classEvents, ...examEvents].sort((left, right) => {
    const leftDate = left.date
      ? new Date(left.date).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightDate = right.date
      ? new Date(right.date).getTime()
      : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || left.sortValue - right.sortValue;
  });
}
