import type dayjs from "dayjs";
import type { AppLocale } from "@/i18n/config";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { prisma as basePrisma, getPrisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { buildExams, buildSessions } from "./dashboard-helpers";
import {
  listSubscribedDashboardSections,
  listSubscribedHomeworks,
} from "./subscription-read-model";

export async function getDashboardCalendarItemsCount(
  userId: string,
  sectionIds: readonly number[],
  referenceNow: dayjs.Dayjs,
  locale: AppLocale,
) {
  const localizedPrisma = getPrisma(locale);
  const semesters = await localizedPrisma.semester.findMany({
    select: {
      id: true,
      nameCn: true,
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

  const semesterStart =
    currentSemester.startDate != null
      ? shanghaiDayjs(currentSemester.startDate).startOf("day")
      : referenceNow.subtract(6, "month").startOf("day");
  const semesterEnd =
    currentSemester.endDate != null
      ? shanghaiDayjs(currentSemester.endDate).endOf("day")
      : referenceNow.add(6, "month").endOf("day");
  const sections = await listSubscribedDashboardSections(userId, {
    locale,
    dateFrom: semesterStart.toDate(),
    dateTo: semesterEnd.toDate(),
    sectionIds,
  });
  const semesterSections = sections.filter(
    (section) => section.semester?.id === currentSemester.id,
  );

  if (semesterSections.length === 0) return 0;

  const semesterSectionIds = semesterSections.map((section) => section.id);
  const [homeworks, todosCount] = await Promise.all([
    listSubscribedHomeworks(userId, {
      locale,
      completed: false,
      sectionIds: semesterSectionIds,
      shape: "dashboard",
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
  const homeworksCount = homeworks.filter((homework) => {
    if (!homework.submissionDueAt) return false;
    const due = shanghaiDayjs(homework.submissionDueAt);
    return (
      !due.isBefore(semesterStart, "day") && !due.isAfter(semesterEnd, "day")
    );
  }).length;

  return (
    buildSessions(semesterSections).length +
    buildExams(semesterSections).length +
    homeworksCount +
    todosCount
  );
}
