import type { TeacherDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

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

export async function getTeacherPage(id: number, locale = "zh-cn") {
  const prisma = getPrisma(locale);
  const teacher = await runCloudflareTraceSpan(
    "catalog.detail.teacher.query",
    { "catalog.detail.kind": "teacher" },
    () =>
      prisma.teacher.findUnique({
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
}
