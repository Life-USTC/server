import {
  buildCurrentSemesterWhere,
  currentSemesterDateKey,
} from "@/features/catalog/lib/current-semester";
import type { Prisma, PrismaClient, Semester } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  type MetadataResponseDto,
  metadataResponseSchema,
} from "@/lib/api/schemas/academic-metadata-response-schemas";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import { prisma } from "@/lib/db/prisma";
import { toLocalizedNameDto } from "@/lib/localized-name";
import { paginatedQuery } from "@/lib/query-pagination";
import { getCanonicalOrigin } from "@/lib/site-url";

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

export function getCachedCurrentSemester(
  referenceDate = new Date(),
  origin = getCanonicalOrigin(),
) {
  const dateKey = currentSemesterDateKey(referenceDate);
  return cachedCatalogRuntimeData(
    "catalog:current-semester",
    `current-semester:${dateKey}`,
    origin,
    () => getCurrentSemester(referenceDate),
  );
}

const metadataLabelSelect = {
  id: true,
  nameCn: true,
  nameEn: true,
} as const satisfies Prisma.EducationLevelSelect;

const metadataCampusSelect = {
  id: true,
  jwId: true,
  nameCn: true,
  nameEn: true,
  code: true,
  buildings: {
    select: {
      id: true,
      jwId: true,
      nameCn: true,
      nameEn: true,
      code: true,
      campusId: true,
    },
  },
} as const satisfies Prisma.CampusSelect;

function localizeMetadataLabels<
  T extends { id: number; nameCn: string; nameEn: string | null },
>(items: T[], locale: AppLocale) {
  return items.map((item) => ({
    id: item.id,
    ...toLocalizedNameDto(item, locale),
  }));
}

export async function getAcademicMetadata(
  locale: AppLocale = DEFAULT_LOCALE,
): Promise<MetadataResponseDto> {
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
    prisma.educationLevel.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.courseCategory.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.courseClassify.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.classType.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.courseType.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.courseGradation.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.examMode.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.teachLanguage.findMany({
      select: metadataLabelSelect,
      orderBy: { nameCn: "asc" },
    }),
    prisma.campus.findMany({
      select: metadataCampusSelect,
      orderBy: { nameCn: "asc" },
    }),
  ]);

  return metadataResponseSchema.parse({
    educationLevels: localizeMetadataLabels(educationLevels, locale),
    courseCategories: localizeMetadataLabels(courseCategories, locale),
    courseClassifies: localizeMetadataLabels(courseClassifies, locale),
    classTypes: localizeMetadataLabels(classTypes, locale),
    courseTypes: localizeMetadataLabels(courseTypes, locale),
    courseGradations: localizeMetadataLabels(courseGradations, locale),
    examModes: localizeMetadataLabels(examModes, locale),
    teachLanguages: localizeMetadataLabels(teachLanguages, locale),
    campuses: campuses.map((campus) => ({
      id: campus.id,
      jwId: campus.jwId,
      code: campus.code,
      ...toLocalizedNameDto(campus, locale),
      buildings: campus.buildings.map((building) => ({
        id: building.id,
        jwId: building.jwId,
        code: building.code,
        campusId: building.campusId,
        ...toLocalizedNameDto(building, locale),
      })),
    })),
  });
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
