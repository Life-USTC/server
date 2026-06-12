import { redactCalendarFeedLocation } from "@/lib/mcp/compact-payload";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

type CalendarSection = {
  id: number;
  jwId: number;
  code: string;
  course: {
    jwId: number;
    code: string;
    namePrimary: string;
    nameSecondary: string | null;
  } | null;
  semester: {
    id: number;
    jwId: number;
    code: string;
    nameCn: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  } | null;
};

export function currentSemesterCalendarSections(
  sections: CalendarSection[],
  now = shanghaiDayjs(),
) {
  return sections.filter((section) => {
    const startDate = section.semester?.startDate;
    const endDate = section.semester?.endDate;
    const start = startDate ? shanghaiDayjs(startDate) : null;
    const end = endDate ? shanghaiDayjs(endDate) : null;
    return (
      (!start || now.isAfter(start, "day") || now.isSame(start, "day")) &&
      (!end || now.isBefore(end, "day") || now.isSame(end, "day"))
    );
  });
}

export function summarizeCalendarSection(section: CalendarSection) {
  return {
    id: section.id,
    jwId: section.jwId,
    code: section.code,
    course: section.course
      ? {
          jwId: section.course.jwId,
          code: section.course.code,
          namePrimary: section.course.namePrimary,
          nameSecondary: section.course.nameSecondary,
        }
      : null,
    semester: section.semester
      ? {
          id: section.semester.id,
          jwId: section.semester.jwId,
          code: section.semester.code,
          nameCn: section.semester.nameCn,
        }
      : null,
  };
}

export function redactCalendarLocationPair(input: {
  calendarPath: string | null;
  calendarUrl: string | null;
}) {
  return {
    calendarPath: redactCalendarFeedLocation(input.calendarPath),
    calendarUrl: redactCalendarFeedLocation(input.calendarUrl),
  };
}
