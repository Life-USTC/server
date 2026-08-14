import type { TeacherDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT } from "@/features/catalog/server/academic-query-includes";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
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

export async function getTeacherPage(
  id: number,
  locale = "zh-cn",
  options: { includeSections?: boolean } = {},
) {
  const prisma = getPrisma(locale);
  const teacher = await prisma.teacher.findUnique({
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
      _count: { select: { sections: true } },
      sections:
        options.includeSections === false
          ? false
          : {
              orderBy: [
                { semester: { jwId: "desc" } },
                { course: { nameCn: "asc" } },
              ],
              take: PUBLIC_DETAIL_SECTION_PREVIEW_LIMIT,
              select: teacherPageSectionsSelect,
            },
    },
  });

  if (!teacher) return null;

  const { _count, sections, ...data } = teacher;
  return toLoadData({
    ...data,
    sectionCount: _count.sections,
    sections: (options.includeSections === false
      ? []
      : sections) as unknown as TeacherDetailSection[],
  });
}
