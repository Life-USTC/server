import { formatScheduleLocation } from "@/lib/location-utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { toMinutes } from "@/shared/lib/time-utils";
import type {
  ExamItem,
  SectionWithRelations,
  SemesterSummary,
  SessionItem,
} from "./dashboard-types";

export const resolveDashboardSections = (
  allSections: SectionWithRelations[],
  currentSemester: SemesterSummary | null,
) => {
  const currentTermSections = currentSemester
    ? allSections.filter(
        (section) => section.semester?.id === currentSemester.id,
      )
    : [];

  const hasAnySelection = allSections.length > 0;
  const hasCurrentTermSelection = currentTermSections.length > 0;
  const dashboardSections = hasCurrentTermSelection ? currentTermSections : [];
  const dashboardSectionIds = Array.from(
    new Set(dashboardSections.map((section) => section.id)),
  );

  return {
    currentTermSections,
    hasAnySelection,
    hasCurrentTermSelection,
    dashboardSections,
    dashboardSectionIds,
  };
};

export const buildSessions = (
  sections: SectionWithRelations[],
): SessionItem[] =>
  sections.flatMap((section) =>
    section.schedules.flatMap((schedule) => {
      if (!schedule.date) return [];
      const teacherDisplay =
        schedule.teachers && schedule.teachers.length > 0
          ? schedule.teachers.map((t) => t.namePrimary).join(", ")
          : "—";
      return [
        {
          id: `s-${section.id}-${schedule.id}`,
          sectionJwId: section.jwId,
          courseName: section.course.namePrimary ?? "",
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: formatScheduleLocation(schedule),
          teacherDisplay,
        },
      ];
    }),
  );

export const sortSessionsByStart = (sessions: SessionItem[]) =>
  [...sessions].sort((a, b) => {
    const d = shanghaiDayjs(a.date).valueOf() - shanghaiDayjs(b.date).valueOf();
    if (d !== 0) return d;
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

const hasExamDetails = (exam: SectionWithRelations["exams"][number]) =>
  Boolean(
    exam.examDate ||
      exam.startTime !== null ||
      exam.endTime !== null ||
      exam.examType !== null ||
      exam.examMode?.trim() ||
      exam.examTakeCount !== null ||
      exam.examRooms?.some((room) => room.room.trim() || room.count > 0),
  );

export const buildExams = (sections: SectionWithRelations[]): ExamItem[] =>
  sections.flatMap((section) =>
    section.exams.filter(hasExamDetails).map((exam) => ({
      id: `e-${section.id}-${exam.id}`,
      courseName: section.course.namePrimary ?? "",
      date: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      examType: exam.examType ?? null,
      examMode: exam.examMode ?? null,
      examTakeCount: exam.examTakeCount ?? null,
      rooms:
        exam.examRooms?.map((r) => ({ room: r.room, count: r.count })) ?? [],
    })),
  );
