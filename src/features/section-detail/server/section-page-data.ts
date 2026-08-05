import { getSectionPageRelatedData } from "@/features/section-detail/server/section-page-related-data";
import {
  buildSectionPageLoadData,
  sectionPageSelect,
  sectionPageTeachersSelect,
  sectionPageTeachersWithDepartmentSelect,
} from "@/features/section-detail/server/section-page-shape";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { toLoadData } from "@/lib/load-data-utils";

type SectionPageRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPageSelect;
}>;

export async function getSectionPage(
  jwId: number,
  locale = "zh-cn",
  options: {
    includeExams?: boolean;
    includeRelated?: boolean;
    includeSchedules?: boolean;
    includeTeacherDepartments?: boolean;
  } = {},
) {
  const prisma = getPrisma(locale);
  const teachersSelect =
    options.includeTeacherDepartments === true
      ? sectionPageTeachersWithDepartmentSelect
      : sectionPageTeachersSelect;
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: {
      ...sectionPageSelect,
      teachers: teachersSelect,
      _count: { select: { exams: true, schedules: true } },
      exams: options.includeExams === false ? false : sectionPageSelect.exams,
      schedules:
        options.includeSchedules === false
          ? false
          : sectionPageSelect.schedules,
    },
  });

  if (!section) return null;

  const relatedData =
    options.includeRelated === false
      ? {
          otherCourseSections: [],
        }
      : await getSectionPageRelatedData({ prisma, section });

  const { _count, exams, schedules, ...data } = section;
  const normalizedSection = {
    ...data,
    examCount: _count.exams,
    exams: options.includeExams === false ? [] : exams,
    scheduleCount: _count.schedules,
    schedules: options.includeSchedules === false ? [] : schedules,
  } as unknown as SectionPageRecord & {
    examCount: number;
    scheduleCount: number;
  };

  return buildSectionPageLoadData(normalizedSection, relatedData);
}

export async function withSectionPageRelatedData(
  section: NonNullable<Awaited<ReturnType<typeof getSectionPage>>>,
  locale = "zh-cn",
) {
  const prisma = getPrisma(locale);
  const relatedData = await getSectionPageRelatedData({ prisma, section });
  return { ...section, ...toLoadData(relatedData) };
}
