import type dayjs from "dayjs";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { prisma as basePrisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { DashboardSubscribedSection } from "./dashboard-user-context";

export async function getDashboardCalendarItemsCount(
  userId: string,
  subscribedSections: readonly DashboardSubscribedSection[],
  referenceNow: dayjs.Dayjs,
) {
  const semesters = await basePrisma.semester.findMany({
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });
  const currentSemester = selectCurrentSemesterFromList(
    semesters,
    referenceNow.toDate(),
  );

  if (!currentSemester) return 0;

  const semesterSectionIds = subscribedSections
    .filter((section) => section.semesterId === currentSemester.id)
    .map((section) => section.id);

  if (semesterSectionIds.length === 0) return 0;

  const semesterStart =
    currentSemester.startDate != null
      ? shanghaiDayjs(currentSemester.startDate).startOf("day")
      : referenceNow.subtract(6, "month").startOf("day");
  const semesterEnd =
    currentSemester.endDate != null
      ? shanghaiDayjs(currentSemester.endDate).endOf("day")
      : referenceNow.add(6, "month").endOf("day");
  const [sessionsCount, examsCount, homeworksCount, todosCount] =
    await Promise.all([
      basePrisma.schedule.count({
        where: {
          sectionId: { in: semesterSectionIds },
          date: {
            gte: semesterStart.toDate(),
            lte: semesterEnd.toDate(),
          },
        },
      }),
      basePrisma.exam.count({
        where: {
          sectionId: { in: semesterSectionIds },
          OR: [
            { examDate: { not: null } },
            { startTime: { not: null } },
            { endTime: { not: null } },
            { examType: { not: null } },
            { examTakeCount: { not: null } },
            { examMode: { not: null } },
            {
              examRooms: {
                some: { OR: [{ room: { not: "" } }, { count: { gt: 0 } }] },
              },
            },
          ],
        },
      }),
      basePrisma.homework.count({
        where: {
          deletedAt: null,
          sectionId: { in: semesterSectionIds },
          submissionDueAt: {
            not: null,
            gte: semesterStart.toDate(),
            lte: semesterEnd.toDate(),
          },
          homeworkCompletions: { none: { userId } },
        },
      }),
      basePrisma.todo.count({
        where: {
          userId,
          completed: false,
          dueAt: {
            not: null,
            gte: semesterStart.toDate(),
            lte: semesterEnd.toDate(),
          },
        },
      }),
    ]);

  return sessionsCount + examsCount + homeworksCount + todosCount;
}
