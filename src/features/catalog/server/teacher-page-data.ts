import type { TeacherDetailSection } from "@/features/catalog/components/catalog-detail-component-types";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

const teacherPageSectionsSelect = {
  jwId: true,
  code: true,
  credits: true,
  course: {
    select: {
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
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
      nameCn: true,
      nameEn: true,
      namePrimary: true,
      nameSecondary: true,
      email: true,
      telephone: true,
      mobile: true,
      address: true,
      department: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
        },
      },
      teacherTitle: {
        select: {
          nameCn: true,
          nameEn: true,
          namePrimary: true,
          nameSecondary: true,
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
