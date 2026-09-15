import type { CourseDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { AppLocale } from "@/i18n/config";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import { isCoursePageCore } from "./catalog-detail-cache-validation";

const coursePageSectionsSelect = {
  jwId: true,
  code: true,
  stdCount: true,
  limitCount: true,
  semester: { select: { nameCn: true } },
  campus: {
    select: {
      ...localizedNameSelect,
    },
  },
  teachers: {
    select: {
      ...localizedNameSelect,
    },
  },
} as const;

const COURSE_PAGE_CORE_CACHE_SHAPE = "page-core-v1";

/**
 * Loads the immutable public course core. Viewer, description, and comments
 * are assembled by catalog-detail-page-server outside this cache boundary.
 */
export async function getCoursePage(jwId: number, locale: AppLocale = "zh-cn") {
  return cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "course",
    locale,
    shape: COURSE_PAGE_CORE_CACHE_SHAPE,
    validateResult: isCoursePageCore,
    load: async () => {
      const prisma = getPrisma(locale);
      const course = await runCloudflareTraceSpan(
        "catalog.detail.course.query",
        { "catalog.detail.kind": "course" },
        async () =>
          await prisma.course.findUnique({
            where: { jwId },
            select: {
              id: true,
              jwId: true,
              code: true,
              ...localizedNameSelect,
              educationLevel: {
                select: {
                  ...localizedNameSelect,
                },
              },
              category: {
                select: {
                  ...localizedNameSelect,
                },
              },
              classType: {
                select: {
                  ...localizedNameSelect,
                },
              },
              type: {
                select: {
                  ...localizedNameSelect,
                },
              },
              sections: {
                orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
                take: PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
                select: coursePageSectionsSelect,
              },
            },
          }),
      );

      if (!course) return null;

      return runCloudflareTraceSpan(
        "catalog.detail.course.transform",
        { "catalog.detail.kind": "course" },
        () => {
          const { sections, ...data } = course;
          return toLoadData({
            ...data,
            sections: sections as unknown as CourseDetailSection[],
          });
        },
      );
    },
  });
}
