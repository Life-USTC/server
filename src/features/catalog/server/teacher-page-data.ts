import type { TeacherDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { AppLocale } from "@/i18n/config";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import { isTeacherPageCore } from "./catalog-detail-cache-validation";

const teacherPageSectionsSelect = {
  jwId: true,
  code: true,
  credits: true,
  course: {
    select: {
      ...localizedNameSelect,
    },
  },
  semester: { select: { nameCn: true } },
} as const;

const TEACHER_PAGE_CORE_CACHE_SHAPE = "page-core-v1";

/**
 * Loads the immutable public teacher core. Viewer, description, and comments
 * are assembled by catalog-detail-page-server outside this cache boundary.
 */
export async function getTeacherPage(id: number, locale: AppLocale = "zh-cn") {
  return cachedPublicDetailRuntimeData({
    id,
    kind: "teacher",
    locale,
    shape: TEACHER_PAGE_CORE_CACHE_SHAPE,
    validateResult: isTeacherPageCore,
    load: async () => {
      const prisma = getPrisma(locale);
      const teacher = await runCloudflareTraceSpan(
        "catalog.detail.teacher.query",
        { "catalog.detail.kind": "teacher" },
        async () =>
          await prisma.teacher.findUnique({
            where: { id },
            select: {
              id: true,
              ...localizedNameSelect,
              email: true,
              telephone: true,
              mobile: true,
              address: true,
              department: {
                select: {
                  ...localizedNameSelect,
                },
              },
              teacherTitle: {
                select: {
                  ...localizedNameSelect,
                },
              },
              sections: {
                orderBy: [
                  { semester: { jwId: "desc" } },
                  { course: { nameCn: "asc" } },
                ],
                take: PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
                select: teacherPageSectionsSelect,
              },
            },
          }),
      );

      if (!teacher) return null;

      return runCloudflareTraceSpan(
        "catalog.detail.teacher.transform",
        { "catalog.detail.kind": "teacher" },
        () => {
          const { sections, ...data } = teacher;
          return toLoadData({
            ...data,
            sections: sections as unknown as TeacherDetailSection[],
          });
        },
      );
    },
  });
}
