import { redactCalendarFeedLocation } from "@/lib/mcp/compact-helpers";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

type CalendarSectionCourse = {
  jwId: number;
  code: string;
  namePrimary?: string;
  nameSecondary?: string | null;
  nameCn?: string;
  nameEn?: string | null;
};

export type CalendarSection = {
  id: number;
  jwId: number;
  code: string;
  course: CalendarSectionCourse | null;
  semester: {
    id: number;
    jwId: number;
    code: string;
    nameCn: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  } | null;
};

function calendarSectionCourseNames(course: CalendarSectionCourse) {
  if ("namePrimary" in course && course.namePrimary) {
    return {
      namePrimary: course.namePrimary,
      nameSecondary: course.nameSecondary ?? null,
    };
  }

  return {
    namePrimary: course.nameCn ?? course.code,
    nameSecondary: course.nameEn ?? null,
  };
}

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
  const course = section.course
    ? {
        jwId: section.course.jwId,
        code: section.course.code,
        ...calendarSectionCourseNames(section.course),
      }
    : null;

  return {
    id: section.id,
    jwId: section.jwId,
    code: section.code,
    course,
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
