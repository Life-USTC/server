import type { CourseDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";
import { resolveCourseIdByJwId } from "./course-jw-id";

const coursePageSectionsSelect = {
  jwId: true,
  code: true,
  stdCount: true,
  limitCount: true,
  semester: { select: { nameCn: true } },
  campus: {
    select: {
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
    },
  },
  teachers: {
    select: {
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
    },
  },
} as const;

export async function getCoursePage(
  jwId: number,
  locale = "zh-cn",
  options: { includeSections?: boolean } = {},
) {
  const prisma = getPrisma(locale);
  const courseId = await resolveCourseIdByJwId(prisma, jwId);
  if (courseId == null) return null;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      jwId: true,
      code: true,
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
      educationLevel: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      category: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      classType: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      type: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      description: {
        select: { content: true, updatedAt: true, lastEditedAt: true },
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
