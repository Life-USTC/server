import type dayjs from "dayjs";
import { formatScheduleLocation } from "@/lib/location-utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getDefaultWeekStart } from "@/shared/lib/date-utils";
import { toMinutes } from "@/shared/lib/time-utils";
import type {
  ExamItem,
  HomeworkWithSection,
  SectionWithRelations,
  SemesterSummary,
  SessionItem,
  TimeSlot,
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

export const buildExams = (sections: SectionWithRelations[]): ExamItem[] =>
  sections.flatMap((section) =>
    section.exams.map((exam) => ({
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

export const filterSessionsByDay = (
  sessions: SessionItem[],
  targetDay: dayjs.Dayjs,
) =>
  sessions.filter((item) => shanghaiDayjs(item.date).isSame(targetDay, "day"));

/** Returns weeks (Mon–Sun) from semester start to end, inclusive. */
export const getSemesterWeeks = (
  semesterStart: dayjs.Dayjs,
  semesterEnd: dayjs.Dayjs,
): dayjs.Dayjs[][] => {
  const weeks: dayjs.Dayjs[][] = [];
  let weekStart = getDefaultWeekStart(semesterStart);
  const lastWeekStart = getDefaultWeekStart(semesterEnd);

  while (
    weekStart.isBefore(lastWeekStart, "day") ||
    weekStart.isSame(lastWeekStart, "day")
  ) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) =>
        weekStart.add(i, "day").startOf("day"),
      ),
    );
    weekStart = weekStart.add(7, "day");
  }

  return weeks;
};

export const selectWeeklySessions = (
  sessions: SessionItem[],
  weekStart: dayjs.Dayjs,
  weekEnd: dayjs.Dayjs,
) =>
  sessions.filter((item) => {
    const date = shanghaiDayjs(item.date);
    return !date.isBefore(weekStart) && date.isBefore(weekEnd);
  });

export const buildWeekDays = (weekStart: dayjs.Dayjs) =>
  Array.from({ length: 7 }, (_, index) => weekStart.add(index, "day"));

export const buildTimeSlots = (weeklySessions: SessionItem[]): TimeSlot[] => {
  const slotsByKey = new Map<string, TimeSlot>();

  for (const { startTime, endTime } of weeklySessions) {
    const key = `${startTime}-${endTime}`;
    if (!slotsByKey.has(key)) {
      slotsByKey.set(key, { key, startTime, endTime });
    }
  }

  return [...slotsByKey.values()].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );
};

export const computeHomeworkBuckets = (
  homeworks: HomeworkWithSection[],
  todayStart: dayjs.Dayjs,
) => {
  const incompleteHomeworks = homeworks.filter(
    (homework) => homework.homeworkCompletions.length === 0,
  );
  const incompleteWithDueAt = incompleteHomeworks.flatMap((homework) =>
    homework.submissionDueAt
      ? [{ homework, due: shanghaiDayjs(homework.submissionDueAt) }]
      : [],
  );
  const dueToday = incompleteWithDueAt
    .filter(({ due }) => due.isSame(todayStart, "day"))
    .map(({ homework }) => homework);
  const dueSoonEnd = todayStart.add(4, "day");
  const dueWithin3Days = incompleteWithDueAt
    .filter(({ due }) => due.isAfter(todayStart) && due.isBefore(dueSoonEnd))
    .map(({ homework }) => homework);

  return { incompleteHomeworks, dueToday, dueWithin3Days };
};
