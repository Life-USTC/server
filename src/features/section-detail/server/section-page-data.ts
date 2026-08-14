import { serializeDescriptionRecord } from "@/features/descriptions/server/description-payload";
import {
  buildSectionPageLoadData,
  SECTION_RELATED_PREVIEW_LIMIT,
  sectionPageDescriptionSelect,
  sectionPageRelatedSectionSelect,
  sectionPageSelect,
  sectionPageTeachersSelect,
  sectionPageTeachersWithDepartmentSelect,
} from "@/features/section-detail/server/section-page-shape";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

type SectionPageRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPageSelect;
}>;

type RelatedSectionRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPageRelatedSectionSelect;
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
  const relatedWhere = {
    jwId: { not: jwId },
    retiredAt: null,
  } as const;
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: {
      ...sectionPageSelect,
      course: {
        select: {
          ...sectionPageSelect.course.select,
          ...(options.includeRelated === false
            ? {}
            : {
                _count: { select: { sections: { where: relatedWhere } } },
                sections: {
                  where: relatedWhere,
                  orderBy: [
                    { semester: { jwId: "desc" as const } },
                    { code: "asc" as const },
                  ],
                  take: SECTION_RELATED_PREVIEW_LIMIT,
                  select: sectionPageRelatedSectionSelect,
                },
              }),
        },
      },
      description: { select: sectionPageDescriptionSelect },
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

  const {
    _count,
    course: courseRecord,
    description,
    exams,
    schedules,
    ...data
  } = section;
  const {
    _count: relatedCount,
    sections: relatedSections,
    ...course
  } = courseRecord as typeof courseRecord & {
    _count?: { sections: number };
    sections?: RelatedSectionRecord[];
  };
  const normalizedSection = {
    ...data,
    course,
    examCount: _count.exams,
    exams: options.includeExams === false ? [] : exams,
    scheduleCount: _count.schedules,
    schedules: options.includeSchedules === false ? [] : schedules,
  } as unknown as SectionPageRecord & {
    examCount: number;
    scheduleCount: number;
  };

  return {
    description: serializeDescriptionRecord(description),
    section: buildSectionPageLoadData(normalizedSection, {
      otherCourseSectionCount: relatedCount?.sections ?? 0,
      otherCourseSections: relatedSections ?? [],
    }),
  };
}
