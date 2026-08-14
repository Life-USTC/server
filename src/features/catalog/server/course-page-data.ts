import type { CourseDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

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

export async function getCoursePage(jwId: number, locale = "zh-cn") {
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
}
