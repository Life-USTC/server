import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import {
  groupByField,
  withSubscribedSections,
} from "./subscription-read-model-shared";
import {
  mapWorkspaceExamRow,
  mapWorkspaceScheduleRow,
  subscriptionScheduleDateFilter,
} from "./subscription-workspace-section-mapping";
import type { SectionWithRelations } from "./subscription-workspace-types";

export async function listSubscribedWorkspaceSections(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    dateFrom,
    dateTo,
    detailSemesterIds,
    sectionIds,
  }: {
    locale?: string;
    dateFrom?: Date;
    dateTo?: Date;
    detailSemesterIds?: readonly number[];
    sectionIds?: readonly number[];
  } = {},
): Promise<SectionWithRelations[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);

      const dateFilter = subscriptionScheduleDateFilter({ dateFrom, dateTo });
      const detailSemesterIdFilter = detailSemesterIds
        ? Array.from(new Set(detailSemesterIds))
        : null;
      const shouldLoadDetails =
        detailSemesterIdFilter === null || detailSemesterIdFilter.length > 0;
      const detailSemesterWhere =
        detailSemesterIdFilter && detailSemesterIdFilter.length > 0
          ? { section: { semesterId: { in: detailSemesterIdFilter } } }
          : {};

      const [sectionRows, scheduleRows, examRows] = await Promise.all([
        localizedPrisma.section.findMany({
          where: { id: { in: ids }, retiredAt: null },
          select: {
            id: true,
            jwId: true,
            course: { select: { namePrimary: true } },
            semester: { select: { id: true } },
          },
          orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
        }),
        shouldLoadDetails
          ? localizedPrisma.schedule.findMany({
              where: {
                sectionId: { in: ids },
                section: { retiredAt: null },
                ...detailSemesterWhere,
                ...(dateFilter ? { date: dateFilter } : {}),
              },
              select: {
                id: true,
                sectionId: true,
                date: true,
                startTime: true,
                endTime: true,
                customPlace: true,
                room: {
                  select: {
                    namePrimary: true,
                    building: {
                      select: {
                        namePrimary: true,
                        campus: { select: { namePrimary: true } },
                      },
                    },
                  },
                },
                teachers: { select: { namePrimary: true } },
              },
              orderBy: [{ date: "asc" }, { startTime: "asc" }],
            })
          : Promise.resolve([]),
        shouldLoadDetails
          ? localizedPrisma.exam.findMany({
              where: {
                sectionId: { in: ids },
                section: { retiredAt: null },
                ...detailSemesterWhere,
              },
              select: {
                id: true,
                sectionId: true,
                examDate: true,
                startTime: true,
                endTime: true,
                examType: true,
                examTakeCount: true,
                examMode: true,
                examRooms: {
                  select: { room: true, count: true },
                  orderBy: { room: "asc" },
                },
              },
              orderBy: [
                { examDate: "asc" },
                { startTime: "asc" },
                { jwId: "asc" },
              ],
            })
          : Promise.resolve([]),
      ]);

      const schedulesBySectionId = groupByField(
        scheduleRows,
        "sectionId",
        mapWorkspaceScheduleRow,
      );

      const examsBySectionId = groupByField(
        examRows,
        "sectionId",
        mapWorkspaceExamRow,
      );

      return sectionRows.map((section) => ({
        id: section.id,
        jwId: section.jwId,
        course: { namePrimary: section.course.namePrimary },
        semester: section.semester,
        schedules: schedulesBySectionId.get(section.id) ?? [],
        exams: examsBySectionId.get(section.id) ?? [],
      }));
    },
    sectionIds,
  );
}
