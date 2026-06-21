import { buildCurrentSemesterWhere } from "@/features/catalog/lib/current-semester";
import type { PrismaClient, Semester } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";

type SemesterFindFirstDelegate = Pick<PrismaClient["semester"], "findFirst">;

export const findCurrentSemester = (
  semesterDelegate: SemesterFindFirstDelegate,
  referenceDate = new Date(),
): Promise<Semester | null> =>
  semesterDelegate.findFirst({
    where: buildCurrentSemesterWhere(referenceDate),
    orderBy: [
      { startDate: "desc" },
      { endDate: "asc" },
      { jwId: "desc" },
      { id: "desc" },
    ],
  });

export const getCurrentSemester = (referenceDate = new Date()) =>
  findCurrentSemester(prisma.semester, referenceDate);

export async function getAcademicMetadata() {
  const [
    educationLevels,
    courseCategories,
    courseClassifies,
    classTypes,
    courseTypes,
    courseGradations,
    examModes,
    teachLanguages,
    campuses,
  ] = await Promise.all([
    prisma.educationLevel.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.courseCategory.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.courseClassify.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.classType.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.courseType.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.courseGradation.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.examMode.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.teachLanguage.findMany({ orderBy: { nameCn: "asc" } }),
    prisma.campus.findMany({
      orderBy: { nameCn: "asc" },
      include: { buildings: true },
    }),
  ]);

  return {
    educationLevels,
    courseCategories,
    courseClassifies,
    classTypes,
    courseTypes,
    courseGradations,
    examModes,
    teachLanguages,
    campuses,
  };
}

export function listSemesters(input: { page: number; pageSize?: number }) {
  return paginatedQuery(
    (skip, take) =>
      prisma.semester.findMany({
        skip,
        take,
        orderBy: { startDate: "desc" },
      }),
    () => prisma.semester.count(),
    input.page,
    input.pageSize,
  );
}
