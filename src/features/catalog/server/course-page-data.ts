import type { CourseDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
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

export async function getCoursePage(
  jwId: number,
  locale = "zh-cn",
  options: { includeSections?: boolean } = {},
) {
  const prisma = getPrisma(locale);
  const course = await prisma.course.findUnique({
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
      _count: { select: { sections: true } },
      sections:
        options.includeSections === false
          ? false
          : {
              orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
              select: coursePageSectionsSelect,
            },
    },
  });

  if (!course) return null;

  const { _count, sections, ...data } = course;
  return toLoadData({
    ...data,
    sectionCount: _count.sections,
    sections: (options.includeSections === false
      ? []
      : sections) as unknown as CourseDetailSection[],
  });
}
