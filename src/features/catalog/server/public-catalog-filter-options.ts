import { cachedCatalogRuntimeData } from "@/features/catalog/server/catalog-runtime-cache";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

export function getCourseListFilterOptions(locale: AppLocale, origin: string) {
  return cachedCatalogRuntimeData(
    `catalog:courses-filter-options:${locale}`,
    "options-v1",
    origin,
    async () => {
      const prisma = getPrisma(locale);
      const [educationLevels, categories, classTypes] = await Promise.all([
        prisma.educationLevel.findMany({ orderBy: { nameCn: "asc" } }),
        prisma.courseCategory.findMany({ orderBy: { nameCn: "asc" } }),
        prisma.classType.findMany({ orderBy: { nameCn: "asc" } }),
      ]);
      return toLoadData({ educationLevels, categories, classTypes });
    },
  );
}

export function getSectionListFilterOptions(locale: AppLocale, origin: string) {
  return cachedCatalogRuntimeData(
    `catalog:sections-filter-options:${locale}`,
    "options-v1",
    origin,
    async () => {
      const prisma = getPrisma(locale);
      const [
        semesters,
        campuses,
        departments,
        categories,
        educationLevels,
        classTypes,
      ] = await Promise.all([
        prisma.semester.findMany({
          select: { id: true, nameCn: true },
          take: 100,
          orderBy: { jwId: "desc" },
        }),
        prisma.campus.findMany({
          where: { sections: { some: { retiredAt: null } } },
          orderBy: { nameCn: "asc" },
        }),
        prisma.department.findMany({
          where: { sections: { some: { retiredAt: null } } },
          orderBy: { nameCn: "asc" },
        }),
        prisma.courseCategory.findMany({
          where: {
            courses: { some: { sections: { some: { retiredAt: null } } } },
          },
          orderBy: { nameCn: "asc" },
        }),
        prisma.educationLevel.findMany({
          where: {
            courses: { some: { sections: { some: { retiredAt: null } } } },
          },
          orderBy: { nameCn: "asc" },
        }),
        prisma.classType.findMany({
          where: {
            courses: { some: { sections: { some: { retiredAt: null } } } },
          },
          orderBy: { nameCn: "asc" },
        }),
      ]);
      return toLoadData({
        campuses,
        categories,
        classTypes,
        departments,
        educationLevels,
        semesters,
      });
    },
  );
}

export function getTeacherListFilterOptions(locale: AppLocale, origin: string) {
  return cachedCatalogRuntimeData(
    `catalog:teachers-filter-options:${locale}`,
    "options-v1",
    origin,
    async () => {
      const prisma = getPrisma(locale);
      const departments = await prisma.department.findMany({
        where: { teachers: { some: {} } },
        select: { id: true, nameCn: true, nameEn: true },
        orderBy: { nameCn: "asc" },
      });
      return toLoadData({ departments });
    },
  );
}
